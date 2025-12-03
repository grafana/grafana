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
            page.goto(login_url, timeout=60000)

            print(f"Page loaded, current URL: {page.url}")
            print(f"Page title: {page.title()}")

            try:
                # Wait for login form - try multiple selector strategies
                print("Waiting for login form to appear...")

                # Try to find by placeholder first (more reliable for older versions)
                username_field = page.get_by_placeholder("email or username")
                password_field = page.get_by_placeholder("password", exact=True)

                username_field.wait_for(state="visible", timeout=60000)
                print("Login form detected")

                # Take screenshot after form is visible
                screenshot_path = os.environ.get("GITHUB_WORKSPACE", ".") + "/login_page.png"
                page.screenshot(path=screenshot_path)
                print(f"Screenshot saved as {screenshot_path}")

                # Fill credentials using placeholder selectors
                print(f"Filling username (length: {len(grafana_username)})")
                username_field.fill(grafana_username)

                print(f"Filling password (length: {len(grafana_password)})")
                password_field.fill(grafana_password)

                print("Credentials filled successfully")

                # Click login button by text
                print("Clicking login button...")
                page.get_by_role("button", name="Log in").click()
                print("Login form submitted")

                # Wait for login to complete
                print("Waiting for post-login navigation...")

                # Try to wait for multiple possible indicators of successful login
                # The page might redirect to setup guide, dashboard, or other pages
                try:
                    # Wait for either: navigation away from login OR any logged-in UI element
                    page.locator('body:not(:has-text("Welcome to Grafana Cloud"))').or_(
                        page.locator('[aria-label="Profile"]')
                    ).or_(
                        page.locator('a:has-text("Home")')
                    ).first.wait_for(state="attached", timeout=15000)

                    print(f"Post-login navigation detected, current URL: {page.url}")

                    # Verify we actually left the login page
                    if "/login" in page.url:
                        raise Exception("Still on login page after navigation")

                except Exception as wait_err:
                    print(f"Login completion wait failed: {wait_err}")
                    if "/login" in page.url:
                        raise Exception(f"Login failed - still on login page: {page.url}")
                    else:
                        print(f"Continuing anyway - URL shows we're logged in: {page.url}")

                print(f"Login successful, current URL: {page.url}")

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
