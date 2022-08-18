import { DataFrameView } from '@grafana/data';

import { Feed, NewsItem } from './types';
import { feedToDataFrame } from './utils';

describe('news', () => {
  test('convert RssFeed to DataFrame', () => {
    const frame = feedToDataFrame(grafana20191216);
    expect(frame.length).toBe(5);

    // Iterate the links
    const view = new DataFrameView<NewsItem>(frame);
    const links = view.map((item: NewsItem) => {
      return item.link;
    });
    expect(links).toEqual([
      'https://grafana.com/blog/2019/12/13/meet-the-grafana-labs-team-aengus-rooney/',
      'https://grafana.com/blog/2019/12/12/register-now-grafanacon-2020-is-coming-to-amsterdam-may-13-14/',
      'https://grafana.com/blog/2019/12/10/pro-tips-dashboard-navigation-using-links/',
      'https://grafana.com/blog/2019/12/09/how-to-do-automatic-annotations-with-grafana-and-loki/',
      'https://grafana.com/blog/2019/12/06/meet-the-grafana-labs-team-ward-bekker/',
    ]);
  });
});

const grafana20191216 = {
  items: [
    {
      title: 'Meet the Grafana Labs Team: Aengus Rooney',
      link: 'https://grafana.com/blog/2019/12/13/meet-the-grafana-labs-team-aengus-rooney/',
      pubDate: 'Fri, 13 Dec 2019 00:00:00 +0000',
      content: '\n\n<p>As Grafana Labs continues to grow, we&rsquo;d like you to get to know the team members...',
    },
    {
      title: 'Register Now! GrafanaCon 2020 Is Coming to Amsterdam May 13-14',
      link: 'https://grafana.com/blog/2019/12/12/register-now-grafanacon-2020-is-coming-to-amsterdam-may-13-14/',
      pubDate: 'Thu, 12 Dec 2019 00:00:00 +0000',
      content: '\n\n<p>Amsterdam, we&rsquo;re coming back!</p>\n\n<p>Mark your calendars for May 13-14, 2020....',
    },
    {
      title: 'Pro Tips: Dashboard Navigation Using Links',
      link: 'https://grafana.com/blog/2019/12/10/pro-tips-dashboard-navigation-using-links/',
      pubDate: 'Tue, 10 Dec 2019 00:00:00 +0000',
      content:
        '\n\n<p>Great dashboards answer a limited set of related questions. If you try to answer too many questions in a single dashboard, it can become overly complex. ...',
    },
    {
      title: 'How to Do Automatic Annotations with Grafana and Loki',
      link: 'https://grafana.com/blog/2019/12/09/how-to-do-automatic-annotations-with-grafana-and-loki/',
      pubDate: 'Mon, 09 Dec 2019 00:00:00 +0000',
      content:
        '\n\n<p>Grafana annotations are great! They clearly mark the occurrence of an event to help operators and devs correlate events with metrics. You may not be aware of this, but Grafana can automatically annotate graphs by ...',
    },
    {
      title: 'Meet the Grafana Labs Team: Ward Bekker',
      link: 'https://grafana.com/blog/2019/12/06/meet-the-grafana-labs-team-ward-bekker/',
      pubDate: 'Fri, 06 Dec 2019 00:00:00 +0000',
      content:
        '\n\n<p>As Grafana Labs continues to grow, we&rsquo;d like you to get to know the team members who are building the cool stuff you&rsquo;re using. Check out the latest of our Friday team profiles.</p>\n\n<h2 id="meet-ward">Meet Ward!</h2>\n\n<p><strong>Name:</strong> Ward...',
    },
  ],
  feedUrl: 'https://grafana.com/blog/index.xml',
  title: 'Blog on Grafana Labs',
  description: 'Recent content in Blog on Grafana Labs',
  generator: 'Hugo -- gohugo.io',
  link: 'https://grafana.com/blog/',
  language: 'en-us',
  lastBuildDate: 'Fri, 13 Dec 2019 00:00:00 +0000',
} as Feed;
