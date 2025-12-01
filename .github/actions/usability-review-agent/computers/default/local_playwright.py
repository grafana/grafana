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
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )

        # Add event listeners for page creation and closure
        context.on("page", self._handle_new_page)

        page = context.new_page()
        page.set_viewport_size({"width": width, "height": height})
        page.on("close", self._handle_page_close)

        # Add logging for debugging
        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page error: {err}"))

        # Navigate to target URL from environment variable, or use docs page as fallback
        target_url = os.environ.get("TARGET_URL", "https://grafana.com/docs/")
        print(f"Navigating to: {target_url}")
        page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
        print(f"Navigation complete, final URL: {page.url}")
        # Give extra time for SPA to initialize
        page.wait_for_timeout(3000)

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
