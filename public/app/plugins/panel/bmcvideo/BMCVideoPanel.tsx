import { PureComponent } from 'react';

import { PanelProps, textUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Trans } from 'app/core/internationalization';

import { VideoOptions } from './types';

interface Props extends PanelProps<VideoOptions> {}

export class BMCVideoPanel extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    let url = textUtil.sanitizeUrl(this.props.options.url);
    if (RegExp(/^(http|https):\/\/[^ "]+$/).test(url)) {
      // Set locale for video if not already set
      try {
        const parsedURL = new URL(url);
        if (!parsedURL.searchParams.has('hl')) {
          parsedURL.searchParams.set('hl', config.bootData.user.language ?? 'en');
          url = parsedURL.toString();
        }
      } catch (e) {}
      //
      return (
        <div>
          <iframe
            src={url}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
            title="BMC Helix Dashboards"
          />
        </div>
      );
    } else {
      return (
        <div className="panel-empty">
          <p>
            <Trans i18nKey="bmc.panel.bmc-video.invalid-url">Not a valid URL</Trans>
          </p>
        </div>
      );
    }
  }
}
