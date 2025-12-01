import subprocess
import time
import shlex


class DockerComputer:
    def get_environment(self):
        return "linux"

    def get_dimensions(self):
        return (1280, 720)  # Default fallback; will be updated in __enter__.

    def __init__(
        self,
        container_name="cua-sample-app",
        image="ghcr.io/openai/openai-cua-sample-app:latest",
        display=":99",
        port_mapping="5900:5900",
    ):
        self.container_name = container_name
        self.image = image
        self.display = display
        self.port_mapping = port_mapping

    def __enter__(self):
        # Check if the container is running
        result = subprocess.run(
            ["docker", "ps", "-q", "-f", f"name={self.container_name}"],
            capture_output=True,
            text=True,
        )

        if not result.stdout.strip():
            raise RuntimeError(
                f"Container {self.container_name} is not running. Build and run with:\n"
                f"docker build -t {self.container_name} .\n"
                f"docker run --rm -it --name {self.container_name} "
                f"-p {self.port_mapping} -e DISPLAY={self.display} {self.container_name}"
            )

        # Fetch display geometry
        geometry = self._exec(
            f"DISPLAY={self.display} xdotool getdisplaygeometry"
        ).strip()
        if geometry:
            w, h = geometry.split()
            self.dimensions = (int(w), int(h))
        # print("Starting Docker container...")
        # # Run the container detached, removing it automatically when it stops
        # subprocess.check_call(
        #     [
        #         "docker",
        #         "run",
        #         "-d",
        #         "--rm",
        #         "--name",
        #         self.container_name,
        #         "-p",
        #         self.port_mapping,
        #         self.image,
        #     ]
        # )
        # # Give the container a moment to start
        # time.sleep(3)
        # print("Entering DockerComputer context")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # print("Stopping Docker container...")
        # subprocess.check_call(["docker", "stop", self.container_name])
        # print("Exiting DockerComputer context")
        pass

    def _exec(self, cmd: str) -> str:
        """
        Run 'cmd' in the container.
        We wrap cmd in double quotes and escape any double quotes inside it,
        so spaces or quotes don't break the shell call.
        """
        # Escape any existing double quotes in cmd
        safe_cmd = cmd.replace('"', '\\"')

        # Then wrap the entire cmd in double quotes for `sh -c`
        docker_cmd = f'docker exec {self.container_name} sh -c "{safe_cmd}"'

        return subprocess.check_output(docker_cmd, shell=True).decode(
            "utf-8", errors="ignore"
        )

    def screenshot(self) -> str:
        """
        Takes a screenshot with ImageMagick (import), returning base64-encoded PNG.
        Requires 'import'.
        """
        # cmd = (
        #     f"export DISPLAY={self.display} && "
        #     "import -window root /tmp/screenshot.png && "
        #     "base64 /tmp/screenshot.png"
        # )
        cmd = (
            f"export DISPLAY={self.display} && "
            "import -window root png:- | base64 -w 0"
        )

        return self._exec(cmd)

    def click(self, x: int, y: int, button: str = "left") -> None:
        button_map = {"left": 1, "middle": 2, "right": 3}
        b = button_map.get(button, 1)
        self._exec(f"DISPLAY={self.display} xdotool mousemove {x} {y} click {b}")

    def double_click(self, x: int, y: int) -> None:
        self._exec(
            f"DISPLAY={self.display} xdotool mousemove {x} {y} click --repeat 2 1"
        )

    def scroll(self, x: int, y: int, scroll_x: int, scroll_y: int) -> None:
        """
        For simple vertical scrolling: xdotool click 4 (scroll up) or 5 (scroll down).
        """
        self._exec(f"DISPLAY={self.display} xdotool mousemove {x} {y}")
        clicks = abs(scroll_y)
        button = 4 if scroll_y < 0 else 5
        for _ in range(clicks):
            self._exec(f"DISPLAY={self.display} xdotool click {button}")

    def type(self, text: str) -> None:
        """
        Type the given text via xdotool, preserving spaces and quotes.
        """
        # Escape single quotes in the user text: ' -> '\'\''
        safe_text = text.replace("'", "'\\''")
        # Then wrap everything in single quotes for xdotool
        cmd = f"DISPLAY={self.display} xdotool type -- '{safe_text}'"
        self._exec(cmd)

    def wait(self, ms: int = 1000) -> None:
        time.sleep(ms / 1000)

    def move(self, x: int, y: int) -> None:
        self._exec(f"DISPLAY={self.display} xdotool mousemove {x} {y}")

    def keypress(self, keys: list[str]) -> None:
        mapping = {
            "ENTER": "Return",
            "LEFT": "Left",
            "RIGHT": "Right",
            "UP": "Up",
            "DOWN": "Down",
            "ESC": "Escape",
            "SPACE": "space",
            "BACKSPACE": "BackSpace",
            "TAB": "Tab",
        }
        mapped_keys = [mapping.get(key, key) for key in keys]
        combo = "+".join(mapped_keys)
        self._exec(f"DISPLAY={self.display} xdotool key {combo}")

    def drag(self, path: list[dict[str, int]]) -> None:
        if not path:
            return
        start_x = path[0]["x"]
        start_y = path[0]["y"]
        self._exec(
            f"DISPLAY={self.display} xdotool mousemove {start_x} {start_y} mousedown 1"
        )
        for point in path[1:]:
            self._exec(
                f"DISPLAY={self.display} xdotool mousemove {point['x']} {point['y']}"
            )
        self._exec(f"DISPLAY={self.display} xdotool mouseup 1")

    def get_current_url(self):
        return None
