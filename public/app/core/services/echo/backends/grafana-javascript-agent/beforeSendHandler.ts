import { TransportItem } from '@grafana/faro-core';

// as listed in https://grafana.com/docs/grafana-cloud/monitor-applications/frontend-observability/instrument/filter-bots/#filter-out-bots-from-collecting-data-for-frontend-observability
const bots =
  '(googlebot|googlebot-mobile|googlebot-image|google favicon|mediapartners-google|' +
  'bingbot|slurp|commons-httpclient|python-urllib|libwww|httpunit|nutch|phpcrawl|' +
  'msnbot|jyxobot|fast-webcrawler|fast enterprise crawler|biglotron|teoma|convera|' +
  'seekbot|gigablast|exabot|ngbot|ia_archiver|gingercrawler|webmon |httrack|' +
  'webcrawler|grub.org|usinenouvellecrawler|antibot|netresearchserver|speedy|fluffy|' +
  'bibnum.bnf|findlink|msrbot|panscient|yacybot|aisearchbot|ioi|ips-agent|tagoobot|' +
  'mj12bot|dotbot|woriobot|yanga|buzzbot|mlbot|yandexbot|purebot|linguee bot|voyager|' +
  'cyberpatrol|voilabot|baiduspider|citeseerxbot|spbot|twengabot|postrank|turnitinbot|' +
  'scribdbot|page2rss|sitebot|linkdex|adidxbot|blekkobot|ezooms|mail.ru_bot|discobot|' +
  'heritrix|findthatfile|europarchive.org|nerdbynature.bot|sistrix crawler|ahrefsbot|' +
  'aboundex|domaincrawler|wbsearchbot|summify|ccbot|edisterbot|seznambot|ec2linkfinder|' +
  'gslfbot|aihitbot|intelium_bot|facebookexternalhit|yeti|retrevopageanalyzer|lb-spider|' +
  'sogou|lssbot|careerbot|wotbox|wocbot|ichiro|duckduckbot|lssrocketcrawler|drupact|' +
  'webcompanycrawler|acoonbot|openindexspider|gnam gnam spider|web-archive-net.com.bot|' +
  'backlinkcrawler|coccoc|integromedb|content crawler spider|toplistbot|seokicks-robot|' +
  'it2media-domain-crawler|ip-web-crawler.com|siteexplorer.info|elisabot|proximic|' +
  'changedetection|blexbot|arabot|wesee:search|niki-bot|crystalsemanticsbot|rogerbot|' +
  '360spider|psbot|interfaxscanbot|lipperhey seo service|cc metadata scraper|g00g1e.net|' +
  'grapeshotcrawler|urlappendbot|brainobot|fr-crawler|binlar|simplecrawler|livelapbot|' +
  'twitterbot|cxensebot|smtbot|bnf.fr_bot|a6-indexer|admantx|facebot|orangebot|' +
  'memorybot|advbot|megaindex|semanticscholarbot|ltx71|nerdybot|xovibot|bubing|' +
  'qwantify|archive.org_bot|applebot|tweetmemebot|crawler4j|findxbot|semrushbot|' +
  'yoozbot|lipperhey|y!j-asr|domain re-animator bot|addthis|bytespider)';

const botsRegex = new RegExp(bots);

export function beforeSendHandler(botFilterEnabled: boolean, item: TransportItem): TransportItem | null {
  if (!botFilterEnabled) {
    return item;
  }

  if (typeof item.meta.browser?.userAgent !== 'string') {
    return null;
  }

  const userAgent = item.meta.browser?.userAgent?.trim().toLowerCase();
  if (!userAgent) {
    return null;
  }

  if (userAgent.length > 512) {
    return null;
  }

  try {
    const isBot = botsRegex.test(userAgent);
    return isBot ? null : item;
  } catch (error) {
    return null;
  }
}
