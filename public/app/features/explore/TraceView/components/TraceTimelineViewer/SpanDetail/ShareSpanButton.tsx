import { LinkModel } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button } from '@grafana/ui';

type Props = {
  focusSpanLink: LinkModel;
};

export function ShareSpanButton(props: Props) {
  const { focusSpanLink } = props;
  return (
    <span>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <a
        data-testid="share-span-button"
        {...focusSpanLink}
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
        <Button variant="secondary" size="sm" icon="share-alt" fill="outline">
          <Trans i18nKey="explore.span-detail.share-span">Share</Trans>
        </Button>
      </a>
    </span>
  );
}
