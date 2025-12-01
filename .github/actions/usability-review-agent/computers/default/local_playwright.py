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

        # Inject service account token only for Grafana instance requests, not external CDNs
        service_account_token = os.environ.get("GRAFANA_SERVICE_ACCOUNT_TOKEN")
        target_url = os.environ.get("TARGET_URL", "https://grafana.com/docs/")

        if service_account_token:
            from urllib.parse import urlparse
            grafana_domain = urlparse(target_url).netloc
            print(f"Will inject Authorization header only for requests to: {grafana_domain}")

            def handle_route(route):
                request_domain = urlparse(route.request.url).netloc
                headers = route.request.headers

                # Only add Authorization header for requests to the Grafana instance
                if request_domain == grafana_domain:
                    headers["Authorization"] = f"Bearer {service_account_token}"

                route.continue_(headers=headers)

            page.route("**/*", handle_route)

        # Add logging for debugging
        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page error: {err}"))

        print(f"Navigating to: {target_url}")

        # Use domcontentloaded since Grafana has continuous network activity
        page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
        print(f"Initial navigation complete, final URL: {page.url}")

        # Wait for Grafana to finish loading by checking for main app container
        try:
            # Wait for the main Grafana app container (found in AppChrome.tsx)
            page.wait_for_selector('.main-view, #pageContent', timeout=30000)
            print("Grafana app loaded successfully")
        except Exception as e:
            print(f"Warning: Could not detect Grafana app loaded state: {e}")
            # Continue anyway - the page might still be functional

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
