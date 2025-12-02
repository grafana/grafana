import os
import base64
from computers import Computer
from computers.default import LocalPlaywrightBrowser
from utils import create_response, check_blocklisted_url


def load_prompt():
    """Load prompt from prompt file (defaults to prompt.txt, can be overridden with PROMPT_FILE env var)."""
    prompt_file = os.environ.get("PROMPT_FILE")
    if not prompt_file:
        prompt_file = os.path.join(os.path.dirname(__file__), "prompt.txt")

    if not os.path.exists(prompt_file):
        raise FileNotFoundError(f"Prompt file not found: {prompt_file}")

    with open(prompt_file, "r", encoding="utf-8") as f:
        prompt = f.read().strip()

    # Inject login credentials if available (not logged, only sent to API)
    username = os.environ.get("GRAFANA_USERNAME")
    password = os.environ.get("GRAFANA_PASSWORD")

    if username and password:
        login_instructions = f"""

## Authentication
Before you begin testing, you need to log in to Grafana. The page will likely show a login screen.

**Credentials:**
- Username: {username}
- Password: {password}

Follow the login flow presented (it may be a form, OAuth button, or other method) and complete authentication before proceeding with usability testing.
"""
        prompt = prompt + login_instructions

    return prompt

def acknowledge_safety_check_callback(message: str) -> bool:
    # Auto-approve in CI/non-interactive environments
    print(f"Safety Check Warning: {message} - Auto-approving in CI mode")
    return True


def handle_item(item, computer: Computer):
    """Handle each item; may cause a computer action + screenshot."""
    if item["type"] == "message":  # print messages
        print(item["content"][0]["text"])

    if item["type"] == "computer_call":  # perform computer actions
        action = item["action"]
        action_type = action["type"]
        action_args = {k: v for k, v in action.items() if k != "type"}
        print(f"{action_type}({action_args})")

        # give our computer environment action to perform
        getattr(computer, action_type)(**action_args)

        screenshot_base64 = computer.screenshot()

        pending_checks = item.get("pending_safety_checks", [])
        for check in pending_checks:
            if not acknowledge_safety_check_callback(check["message"]):
                raise ValueError(f"Safety check failed: {check['message']}")

        # return value informs model of the latest screenshot
        call_output = {
            "type": "computer_call_output",
            "call_id": item["call_id"],
            "acknowledged_safety_checks": pending_checks,
            "output": {
                "type": "input_image",
                "image_url": f"data:image/png;base64,{screenshot_base64}",
            },
        }

        # additional URL safety checks for browser environments
        if computer.get_environment() == "browser":
            current_url = computer.get_current_url()
            call_output["output"]["current_url"] = current_url
            check_blocklisted_url(current_url)

        return [call_output]

    return []


def main():
    """Run the CUA (Computer Use Assistant) loop, using Local Playwright."""
    output_text_path = os.environ.get("OUTPUT_TEXT_PATH", "output.txt")
    screenshot_path = os.environ.get("SCREENSHOT_PATH", "output.png")
    all_messages = []  # Collect all model messages
    last_screenshot_base64 = None
    
    with LocalPlaywrightBrowser(headless=True) as computer:
        dimensions = computer.get_dimensions()
        tools = [
            {
                "type": "computer-preview",
                "display_width": dimensions[0],
                "display_height": dimensions[1],
                "environment": computer.get_environment(),
            }
        ]

        items = []
        # Load the task prompt from prompt.txt
        user_input = load_prompt()
        items.append({"role": "user", "content": user_input})

        while True:  # keep looping until we get a final response
            response = create_response(
                model="computer-use-preview",
                input=items,
                tools=tools,
                truncation="auto",
            )

            if "output" not in response:
                print(response)
                raise ValueError("No output from model")

            items += response["output"]

            for item in response["output"]:
                # Collect all message output from the model
                if item.get("type") == "message":
                    content = item.get("content", [])
                    for content_item in content:
                        if isinstance(content_item, dict) and "text" in content_item:
                            text = content_item["text"]
                            all_messages.append(text)
                
                result = handle_item(item, computer)
                items += result
                
                # Capture last screenshot from computer_call outputs
                if result and len(result) > 0:
                    for output_item in result:
                        if output_item.get("type") == "computer_call_output":
                            output = output_item.get("output", {})
                            if output.get("type") == "input_image":
                                image_url = output.get("image_url", "")
                                if image_url.startswith("data:image/png;base64,"):
                                    last_screenshot_base64 = image_url.split(",", 1)[1]

            if items[-1].get("role") == "assistant":
                break
        
        # Take one final screenshot before closing
        if not last_screenshot_base64:
            try:
                last_screenshot_base64 = computer.screenshot()  # Returns base64 string directly
            except:
                pass

    # Save the last screenshot to file
    if last_screenshot_base64:
        os.makedirs(os.path.dirname(screenshot_path) or ".", exist_ok=True)
        with open(screenshot_path, "wb") as f:
            f.write(base64.b64decode(last_screenshot_base64))

    # Save all model output messages to file
    os.makedirs(os.path.dirname(output_text_path) or ".", exist_ok=True)
    with open(output_text_path, "w") as f:
        if all_messages:
            # Join all messages with double newlines for readability
            f.write("\n\n".join(all_messages))
        else:
            # Fallback: save error message if no messages were captured
            f.write("No model output messages were captured.")


if __name__ == "__main__":
    main()
