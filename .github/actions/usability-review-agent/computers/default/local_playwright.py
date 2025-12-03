import os
from playwright.sync_api import Browser, Page
from ..shared.base_playwright import BasePlaywrightComputer


class LocalPlaywrightBrowser(BasePlaywrightComputer):
    """Launches a local Chromium instance using Playwright."""

    def __init__(self, headless: bool = False):
        super().__init__()
        self.headless = headless

    def _get_browser_and_page(self) -> tuple[Browser, Page]:
        width, height = self.get_dimensions()
        launch_args = [
            f"--window-size={width},{height}",
            "--disable-extensions",
            "--disable-file-system",
        ]
        browser = self._playwright.chromium.launch(
            chromium_sandbox=False,
            headless=self.headless,
            args=launch_args,
            env={"DISPLAY": ":0"},
        )

        context = browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="en-US",
            timezone_id="UTC"
        )

        # Add event listeners for page creation and closure
        context.on("page", self._handle_new_page)

        page = context.new_page()
        page.set_viewport_size({"width": width, "height": height})
        page.on("close", self._handle_page_close)

        # Add logging for debugging
        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page error: {err}"))

        target_url = os.environ.get("TARGET_URL", "https://grafana.com/docs/")
        grafana_username = os.environ.get("GRAFANA_USERNAME")
        grafana_password = os.environ.get("GRAFANA_PASSWORD")

        # If credentials provided, log in first
        if grafana_username and grafana_password:
            from urllib.parse import urlparse, urljoin

            base_url = f"{urlparse(target_url).scheme}://{urlparse(target_url).netloc}"
            login_url = urljoin(base_url, "/login")

            print(f"Logging in to: {login_url}")
            page.goto(login_url, wait_until="domcontentloaded", timeout=60000)

            print(f"Page loaded, current URL: {page.url}")
            print(f"Page title: {page.title()}")

            # Take screenshot to see what's on the page
            screenshot_path = os.environ.get("GITHUB_WORKSPACE", ".") + "/login_page.png"
            page.screenshot(path=screenshot_path)
            print(f"Screenshot saved as {screenshot_path}")

            try:
                # Wait for login form using Grafana's data-testid selectors
                print("Waiting for login form...")
                page.wait_for_selector('[data-testid="Username input field"]', state="visible", timeout=10000)
                print("Login form detected")

                # Fill credentials
                print(f"Filling username (length: {len(grafana_username)})")
                page.locator('[data-testid="Username input field"]').fill(grafana_username)

                print(f"Filling password (length: {len(grafana_password)})")
                page.locator('[data-testid="Password input field"]').fill(grafana_password)

                print("Credentials filled successfully")

                # Click login button
                print("Clicking login button...")
                page.click('[data-testid="Login button"]')
                print("Login form submitted")

                # Try to wait for navigation, but don't fail if it doesn't happen
                try:
                    print("Waiting for navigation...")
                    page.wait_for_navigation(timeout=5000)
                    print("Navigation occurred after login")
                except Exception as nav_err:
                    print(f"No navigation detected: {nav_err}")
                    print("Waiting for in-page changes...")
                    page.wait_for_timeout(2000)

                print(f"Current URL after login: {page.url}")
                print(f"Page title: {page.title()}")

                # Check for login errors
                error_locator = page.locator('[data-testid="alert-error"]')
                print("Checking for error alerts...")
                if error_locator.is_visible():
                    error_text = error_locator.text_content()
                    print(f"Error alert found: {error_text}")
                    raise Exception(f"Login failed with error: {error_text}")
                else:
                    print("No error alerts found")

                # Verify we're no longer on the login page
                if "/login" in page.url:
                    print("Still on login page - login failed")
                    raise Exception(f"Login appears to have failed - still on login page: {page.url}")

                print(f"Login successful, navigated to: {page.url}")

            except Exception as e:
                print(f"Login failed: {e}")
                print(f"Current URL at error: {page.url}")
                print(f"Page title at error: {page.title()}")

                # Get page content for debugging
                try:
                    body_text = page.locator('body').text_content()
                    print(f"Page body text (first 500 chars): {body_text[:500] if body_text else 'No body text'}")
                except Exception as content_err:
                    print(f"Could not get page content: {content_err}")

                error_screenshot_path = os.environ.get("GITHUB_WORKSPACE", ".") + "/login_error.png"
                page.screenshot(path=error_screenshot_path)
                print(f"Error screenshot saved as {error_screenshot_path}")
                raise

        print(f"Navigating to: {target_url}")
        page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
        print(f"Page loaded, URL: {page.url}")

        return browser, page

    def _handle_new_page(self, page: Page):
        """Handle the creation of a new page."""
        print("New page created")
        self._page = page
        page.on("close", self._handle_page_close)

    def _handle_page_close(self, page: Page):
        """Handle the closure of a page."""
        print("Page closed")
        if self._page == page:
            if self._browser.contexts[0].pages:
                self._page = self._browser.contexts[0].pages[-1]
            else:
                print("Warning: All pages have been closed.")
                self._page = None
