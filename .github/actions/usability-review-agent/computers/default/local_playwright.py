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

            try:
                # Wait for login form
                page.wait_for_selector('input[name="user"], input[name="username"]', timeout=10000)
                print("Login form detected")

                # Fill credentials
                username_input = page.locator('input[name="user"], input[name="username"]').first
                password_input = page.locator('input[name="password"]').first

                username_input.fill(grafana_username)
                password_input.fill(grafana_password)
                print(f"Credentials filled - username length: {len(grafana_username)}, password length: {len(grafana_password)}")

                # Verify the values were actually filled
                filled_username = username_input.input_value()
                filled_password = password_input.input_value()
                print(f"Verified filled values - username length: {len(filled_username)}, password length: {len(filled_password)}")

                # Submit form and wait for navigation
                submit_button = page.locator('button[type="submit"]').first
                submit_button.click()
                print("Login form submitted")

                # Wait for navigation away from login page
                page.wait_for_load_state("domcontentloaded", timeout=60000)
                print(f"Page loaded after login, current URL: {page.url}")

                # Verify we're no longer on the login page
                if "/login" in page.url:
                    raise Exception(f"Login appears to have failed - still on login page: {page.url}")

                print(f"Login successful, navigated to: {page.url}")

            except Exception as e:
                print(f"Login failed: {e}")
                page.screenshot(path="login_error.png")
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
