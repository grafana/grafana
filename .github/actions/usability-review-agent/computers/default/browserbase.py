import os
from typing import Tuple, Dict, List, Union, Optional
from playwright.sync_api import Browser, Page, BrowserContext, Error as PlaywrightError
from ..shared.base_playwright import BasePlaywrightComputer
from browserbase import Browserbase
from dotenv import load_dotenv
import base64

load_dotenv()


class BrowserbaseBrowser(BasePlaywrightComputer):
    """
    Browserbase is a headless browser platform that offers a remote browser API. You can use it to control thousands of browsers from anywhere.
    You can find more information about Browserbase at https://www.browserbase.com/computer-use or view our OpenAI CUA Quickstart at https://docs.browserbase.com/integrations/openai-cua/introduction.

    IMPORTANT: This Browserbase computer requires the use of the `goto` tool defined in playwright_with_custom_functions.py.
    Make sure to include this tool in your configuration when using the Browserbase computer.
    """

    def get_dimensions(self):
        return self.dimensions

    def __init__(
        self,
        width: int = 1024,
        height: int = 768,
        region: str = "us-west-2",
        proxy: bool = False,
        virtual_mouse: bool = True,
        ad_blocker: bool = False,
    ):
        """
        Initialize the Browserbase instance. Additional configuration options for features such as persistent cookies, ad blockers, file downloads and more can be found in the Browserbase API documentation: https://docs.browserbase.com/reference/api/create-a-session

        Args:
            width (int): The width of the browser viewport. Default is 1024.
            height (int): The height of the browser viewport. Default is 768.
            region (str): The region for the Browserbase session. Default is "us-west-2". Pick a region close to you for better performance. https://docs.browserbase.com/guides/multi-region
            proxy (bool): Whether to use a proxy for the session. Default is False. Turn on proxies if you're browsing is frequently interrupted. https://docs.browserbase.com/features/proxies
            virtual_mouse (bool): Whether to enable the virtual mouse cursor. Default is True.
            ad_blocker (bool): Whether to enable the built-in ad blocker. Default is False.
        """
        super().__init__()
        self.bb = Browserbase(api_key=os.getenv("BROWSERBASE_API_KEY"))
        self.project_id = os.getenv("BROWSERBASE_PROJECT_ID")
        self.session = None
        self.dimensions = (width, height)
        self.region = region
        self.proxy = proxy
        self.virtual_mouse = virtual_mouse
        self.ad_blocker = ad_blocker

    def _get_browser_and_page(self) -> Tuple[Browser, Page]:
        """
        Create a Browserbase session and connect to it.

        Returns:
            Tuple[Browser, Page]: A tuple containing the connected browser and page objects.
        """
        # Create a session on Browserbase with specified parameters
        width, height = self.dimensions
        session_params = {
            "project_id": self.project_id,
            "browser_settings": {
                "viewport": {"width": width, "height": height},
                "blockAds": self.ad_blocker,
            },
            "region": self.region,
            "proxies": self.proxy,
        }
        self.session = self.bb.sessions.create(**session_params)

        # Print the live session URL
        print(
            f"Watch and control this browser live at https://www.browserbase.com/sessions/{self.session.id}"
        )

        # Connect to the remote session
        browser = self._playwright.chromium.connect_over_cdp(
            self.session.connect_url, timeout=60000
        )
        context = browser.contexts[0]

        # Add event listeners for page creation and closure
        context.on("page", self._handle_new_page)

        # Only add the init script if virtual_mouse is True
        if self.virtual_mouse:
            context.add_init_script(
                """
            // Only run in the top frame
            if (window.self === window.top) {
                function initCursor() {
                    const CURSOR_ID = '__cursor__';

                    // Check if cursor element already exists
                    if (document.getElementById(CURSOR_ID)) return;

                    const cursor = document.createElement('div');
                    cursor.id = CURSOR_ID;
                    Object.assign(cursor.style, {
                        position: 'fixed',
                        top: '0px',
                        left: '0px',
                        width: '20px',
                        height: '20px',
                        backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\' fill=\\'black\\' stroke=\\'white\\' stroke-width=\\'1\\' stroke-linejoin=\\'round\\' stroke-linecap=\\'round\\'><polygon points=\\'2,2 2,22 8,16 14,22 17,19 11,13 20,13\\'/></svg>")',
                        backgroundSize: 'cover',
                        pointerEvents: 'none',
                        zIndex: '99999',
                        transform: 'translate(-2px, -2px)',
                    });

                    document.body.appendChild(cursor);

                    document.addEventListener("mousemove", (e) => {
                        cursor.style.top = e.clientY + "px";
                        cursor.style.left = e.clientX + "px";
                    });
                }

                // Use requestAnimationFrame for early execution
                requestAnimationFrame(function checkBody() {
                    if (document.body) {
                        initCursor();
                    } else {
                        requestAnimationFrame(checkBody);
                    }
                });
            }
            """
            )

        page = context.pages[0]
        page.on("close", self._handle_page_close)

        page.goto("https://bing.com")

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

    def __exit__(self, exc_type, exc_val, exc_tb):
        """
        Clean up resources when exiting the context manager.

        Args:
            exc_type: The type of the exception that caused the context to be exited.
            exc_val: The exception instance that caused the context to be exited.
            exc_tb: A traceback object encapsulating the call stack at the point where the exception occurred.
        """
        if self._page:
            self._page.close()
        if self._browser:
            self._browser.close()
        if self._playwright:
            self._playwright.stop()

        if self.session:
            print(
                f"Session completed. View replay at https://browserbase.com/sessions/{self.session.id}"
            )

    def screenshot(self) -> str:
        """
        Capture a screenshot of the current viewport using CDP.

        Returns:
            str: A base64 encoded string of the screenshot.
        """
        try:
            # Get CDP session from the page
            cdp_session = self._page.context.new_cdp_session(self._page)

            # Capture screenshot using CDP
            result = cdp_session.send(
                "Page.captureScreenshot", {"format": "png", "fromSurface": True}
            )

            return result["data"]
        except PlaywrightError as error:
            print(
                f"CDP screenshot failed, falling back to standard screenshot: {error}"
            )
            return super().screenshot()
