import os
import time
from dotenv import load_dotenv
from scrapybara import Scrapybara
from playwright.sync_api import sync_playwright, Browser, Page
from utils import BLOCKED_DOMAINS

load_dotenv()

CUA_KEY_TO_SCRAPYBARA_KEY = {
    "/": "slash",
    "\\": "backslash",
    "arrowdown": "Down",
    "arrowleft": "Left",
    "arrowright": "Right",
    "arrowup": "Up",
    "backspace": "BackSpace",
    "capslock": "Caps_Lock",
    "cmd": "Meta_L",
    "delete": "Delete",
    "end": "End",
    "enter": "Return",
    "esc": "Escape",
    "home": "Home",
    "insert": "Insert",
    "option": "Alt_L",
    "pagedown": "Page_Down",
    "pageup": "Page_Up",
    "tab": "Tab",
    "win": "Meta_L",
}


class ScrapybaraBrowser:
    """
    Scrapybara provides virtual desktops and browsers in the cloud. https://scrapybara.com
    You can try OpenAI CUA for free at https://computer.new or read our CUA Quickstart at https://computer.new/cua.
    """

    def get_environment(self):
        return "browser"

    def get_dimensions(self):
        return (1024, 768)

    def __init__(self):
        self.client = Scrapybara(api_key=os.getenv("SCRAPYBARA_API_KEY"))
        self._playwright = None
        self._browser: Browser | None = None
        self._page: Page | None = None

    def __enter__(self):
        print("Starting scrapybara browser")
        blocked_domains = [
            domain.replace("https://", "").replace("www.", "")
            for domain in BLOCKED_DOMAINS
        ]
        self.instance = self.client.start_browser(blocked_domains=blocked_domains)
        print("Scrapybara browser started ₍ᐢ•(ܫ)•ᐢ₎")
        print(
            f"You can view and interact with the stream at {self.instance.get_stream_url().stream_url}"
        )
        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.connect_over_cdp(
            self.instance.get_cdp_url().cdp_url
        )
        self._page = self._browser.contexts[0].pages[0]
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        print("Stopping scrapybara browser")
        self.instance.stop()
        print("Scrapybara browser stopped ₍ᐢ-(ｪ)-ᐢ₎")

    def goto(self, url: str) -> None:
        self._page.goto(url)

    def get_current_url(self) -> str:
        return self.instance.get_current_url().current_url

    def screenshot(self) -> str:
        return self.instance.screenshot().base_64_image

    def click(self, x: int, y: int, button: str = "left") -> None:
        button = "middle" if button == "wheel" else button
        self.instance.computer(
            action="click_mouse",
            click_type="click",
            button=button,
            coordinates=[x, y],
            num_clicks=1,
        )

    def double_click(self, x: int, y: int) -> None:
        self.instance.computer(
            action="click_mouse",
            click_type="click",
            button="left",
            coordinates=[x, y],
            num_clicks=2,
        )

    def scroll(self, x: int, y: int, scroll_x: int, scroll_y: int) -> None:
        self.instance.computer(
            action="scroll",
            coordinates=[x, y],
            delta_x=scroll_x // 20,
            delta_y=scroll_y // 20,
        )

    def type(self, text: str) -> None:
        self.instance.computer(action="type_text", text=text)

    def wait(self, ms: int = 1000) -> None:
        time.sleep(ms / 1000)
        # Scrapybara also has `self.instance.computer(action="wait", duration=ms / 1000)`

    def move(self, x: int, y: int) -> None:
        self.instance.computer(action="move_mouse", coordinates=[x, y])

    def keypress(self, keys: list[str]) -> None:
        mapped_keys = [
            CUA_KEY_TO_SCRAPYBARA_KEY.get(key.lower(), key.lower()) for key in keys
        ]
        self.instance.computer(action="press_key", keys=mapped_keys)

    def drag(self, path: list[dict[str, int]]) -> None:
        if not path:
            return
        path = [[point["x"], point["y"]] for point in path]
        self.instance.computer(action="drag_mouse", path=path)


class ScrapybaraUbuntu:
    """
    Scrapybara provides virtual desktops and browsers in the cloud.
    You can try OpenAI CUA for free at https://computer.new or read our CUA Quickstart at https://computer.new/cua.
    """

    def get_environment(self):
        return "linux"

    def get_dimensions(self):
        return (1024, 768)

    def __init__(self):
        self.client = Scrapybara(api_key=os.getenv("SCRAPYBARA_API_KEY"))

    def __enter__(self):
        print("Starting Scrapybara Ubuntu instance")
        blocked_domains = [
            domain.replace("https://", "").replace("www.", "")
            for domain in BLOCKED_DOMAINS
        ]
        self.instance = self.client.start_ubuntu(blocked_domains=blocked_domains)
        print("Scrapybara Ubuntu instance started ₍ᐢ•(ܫ)•ᐢ₎")
        print(
            f"You can view and interact with the stream at {self.instance.get_stream_url().stream_url}"
        )
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        print("Stopping Scrapybara Ubuntu instance")
        self.instance.stop()
        print("Scrapybara Ubuntu instance stopped ₍ᐢ-(ｪ)-ᐢ₎")

    def screenshot(self) -> str:
        return self.instance.screenshot().base_64_image

    def click(self, x: int, y: int, button: str = "left") -> None:
        button = "middle" if button == "wheel" else button
        self.instance.computer(
            action="click_mouse",
            click_type="click",
            button=button,
            coordinates=[x, y],
            num_clicks=1,
        )

    def double_click(self, x: int, y: int) -> None:
        self.instance.computer(
            action="click_mouse",
            click_type="click",
            button="left",
            coordinates=[x, y],
            num_clicks=2,
        )

    def scroll(self, x: int, y: int, scroll_x: int, scroll_y: int) -> None:
        self.instance.computer(
            action="scroll",
            coordinates=[x, y],
            delta_x=scroll_x // 20,
            delta_y=scroll_y // 20,
        )

    def type(self, text: str) -> None:
        self.instance.computer(action="type_text", text=text)

    def wait(self, ms: int = 1000) -> None:
        time.sleep(ms / 1000)
        # Scrapybara also has `self.instance.computer(action="wait", duration=ms / 1000)`

    def move(self, x: int, y: int) -> None:
        self.instance.computer(action="move_mouse", coordinates=[x, y])

    def keypress(self, keys: list[str]) -> None:
        mapped_keys = [
            CUA_KEY_TO_SCRAPYBARA_KEY.get(key.lower(), key.lower()) for key in keys
        ]
        self.instance.computer(action="press_key", keys=mapped_keys)

    def drag(self, path: list[dict[str, int]]) -> None:
        if not path:
            return
        path = [[point["x"], point["y"]] for point in path]
        self.instance.computer(action="drag_mouse", path=path)

    def get_current_url(self):
        return None
