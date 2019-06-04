export function getBrowserOS(userAgent: string): string {
  const browser = userAgent.match(/(MSIE|Firefox|Chrome|Safari|Edge|Opera)/gi),
    os = userAgent.match(/(Windows|Linux|iOS|Android|OS |Mac OS)(?: |\s|\d|\w)([^;|)]*)/gi);

  let browserOS = browser.length ? browser[0] + ' on ' : 'Undetected browser on ';

  browserOS += os[0].replace(/_/g, '.');
  return browserOS;
}
