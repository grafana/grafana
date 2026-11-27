import { Trans } from '@grafana/i18n';

import { CatalogPreview } from '../../CatalogPreview';

export interface InlineReplyProps {
  turn?: { readonly isStreaming: boolean };
}

export function CatalogReply({ componentId, reply }: { componentId: string; reply: InlineReplyProps }) {
  if (reply.turn?.isStreaming) {
    return (
      <span role="status">
        <Trans i18nKey="plugins.catalog-reply.waiting">Waiting for the reply to finish…</Trans>
      </span>
    );
  }
  return <CatalogPreview componentId={componentId} filters={[]} />;
}
