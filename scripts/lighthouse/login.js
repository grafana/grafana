async function main(browser, { url }) {
  const page = await browser.newPage();

  await page.goto(`${new URL(url).origin}/login`, { waitUntil: 'domcontentloaded' });
  await page.type('[aria-label="Username input field"]', 'admin');
  await page.type('[aria-label="Password input field"]', 'admin');
  await page.click('[aria-label="Login button"]');
  await Promise.all([
    page.waitForNavigation(),
    page.waitForSelector('[aria-label="Skip change password button"]').then(a => a.click()),
  ]);
  await page.close();
}

module.exports = main;
