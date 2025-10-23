import { css } from '@emotion/css';

import { GrafanaTheme2, LinkModel } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';

type Props = {
  focusSpanLink: LinkModel;
};

function getStyles(theme: GrafanaTheme2) {
  return {
    shareButton: css({
      [theme.breakpoints.down('sm')]: {
        span: {
          display: 'none',
        },
      },
    }),
  };
}

export function ShareSpanButton(props: Props) {
  const { focusSpanLink } = props;
  const { interpolatedParams, ...linkProps } = focusSpanLink ?? {};
  const styles = useStyles2(getStyles);
  return (
    <span>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <a
        data-testid="share-span-button"
        {...linkProps}
        onClick={(e) => {
          // click handling logic copied from react router:
          // https://github.com/remix-run/react-router/blob/997b4d67e506d39ac6571cb369d6d2d6b3dda557/packages/react-router-dom/index.tsx#L392-L394s
          if (
            focusSpanLink.onClick &&
            e.button === 0 && // Ignore everything but left clicks
            (!e.currentTarget.target || e.currentTarget.target === '_self') && // Let browser handle "target=_blank" etc.
            !(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) // Ignore clicks with modifier keys
          ) {
            e.preventDefault();
            focusSpanLink.onClick(e);
          }
        }}
      >
        <Button variant="secondary" size="sm" icon="share-alt" fill="outline" className={styles.shareButton}>
          <Trans i18nKey="explore.span-detail.share-span">Share</Trans>
        </Button>
      </a>
    </span>
  );
}
