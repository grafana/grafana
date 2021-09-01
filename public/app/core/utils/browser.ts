/**
 * Check to see if browser is not supported by Grafana
 * This function is copied to index-template.html but is here so we can write tests
 *  */
export function checkBrowserCompatibility() {
  const isIE = navigator.userAgent.indexOf('MSIE') > -1;
  const isEdge = navigator.userAgent.indexOf('Edge/') > -1 || navigator.userAgent.indexOf('Edg/') > -1;
  const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

  /* Check for
     <= IE11 (Trident 7)
     Edge <= 16
     Firefox <= 64
     Chrome <= 54
    */
  const isEdgeVersion = /Edge\/([0-9.]+)/.exec(navigator.userAgent);

  if (isIE && parseFloat(/Trident\/([0-9.]+)/.exec(navigator.userAgent)![1]) <= 7) {
    return false;
  } else if (
    isEdge &&
    ((isEdgeVersion && parseFloat(isEdgeVersion[1]) <= 16) ||
      parseFloat(/Edg\/([0-9.]+)/.exec(navigator.userAgent)![1]) <= 16)
  ) {
    return false;
  } else if (isFirefox && parseFloat(/Firefox\/([0-9.]+)/.exec(navigator.userAgent)![1]) <= 64) {
    return false;
  } else if (isChrome && parseFloat(/Chrome\/([0-9.]+)/.exec(navigator.userAgent)![1]) <= 54) {
    return false;
  }

  return true;
}
