import React from 'react';
import { PanelProps } from '@grafana/data';
import { VideoOptions } from 'types';
import { css, cx } from 'emotion';
import { stylesFactory } from '@grafana/ui';
import qs from 'query-string';

interface Props extends PanelProps<VideoOptions> {}

export const YoutubePanel: React.FC<Props> = ({ options, width, height }) => {
  const styles = getStyles();
  let videoURL: any = '';

  const youtubeParams = {
    loop: 0,
    autoplay: 0,
    playlist: options.videoId,
  };

  if (options.autoPlay) {
    youtubeParams.autoplay = 1;
  }

  if (options.loop) {
    youtubeParams.loop = 1;
  }

  videoURL = 'https://www.youtube.com/embed/' + options.videoId + '?' + qs.stringify(youtubeParams);

  return (
    <div
      className={cx(
        styles.wrapper,
        css`
          width: ${width}px;
          height: ${height}px;
        `
      )}
    >
      <iframe
        frameBorder="0"
        allowFullScreen
        className={cx(
          styles.video,
          css`
            width: ${width}px;
            height: ${height}px;
          `
        )}
        src={videoURL}
      ></iframe>
    </div>
  );
};

const getStyles = stylesFactory(() => {
  return {
    wrapper: css`
      position: absolute;
    `,
    video: css`
      top: 0;
      left: 0;
    `,
  };
});
