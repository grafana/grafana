import { getConfig } from 'app/core/config';

import { Page } from '../Page/Page';

export function ErrorPage() {
  const homePage = getConfig().appSubUrl + '/';
  return (
    <Page navId="not-found">
      <Page.Contents>
        <div className="bmc_error_container page-body">
          <div>
            <img src="public/img/bmc_page_not_found_icon.svg" alt="" />
          </div>
          <div>
            <h3 className="bmc_error_main_text">Oops... we could not load that page.</h3>
          </div>
          <div className="bmc_error_sub_text">
            <p>This page might have been removed, had its name changed, or is temporarily unavailable.</p>
            <p>
              Go back to the&nbsp;
              <a className="bmc_error_links" href={homePage}>
                Home Page
              </a>
              , or contact&nbsp;
              <a className="bmc_error_links" href="https://www.bmc.com/support" target="_blank" rel="noreferrer">
                BMC Support
              </a>
              .
            </p>
          </div>
        </div>
      </Page.Contents>
      <Page.Contents>
        <div className="bmc_error_container page-body">
          <div>
            <img src="public/img/bmc_page_not_found_icon.svg" alt="" />
          </div>
          <div>
            <h3 className="bmc_error_main_text">Oops... we could not load that page.</h3>
          </div>
          <div className="bmc_error_sub_text">
            <p>This page might have been removed, had its name changed, or is temporarily unavailable.</p>
            <p>
              Go back to the&nbsp;
              <a className="bmc_error_links" href={homePage}>
                Home Page
              </a>
              , or contact&nbsp;
              <a className="bmc_error_links" href="https://www.bmc.com/support" target="_blank" rel="noreferrer">
                BMC Support
              </a>
              .
            </p>
          </div>
        </div>
      </Page.Contents>
    </Page>
  );
}

export default ErrorPage;
