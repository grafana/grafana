import Skeleton from 'react-loading-skeleton';

import { useGetFolderCountsQuery } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { Trans, t } from '@grafana/i18n';
import { Text, Tooltip } from '@grafana/ui';
import { getParsedCounts } from 'app/api/clients/folder/v1beta1/utils';

import { type RuleKind, ruleCountLabel } from '../shared/ruleKind';

interface FolderRuleCountProps {
  folderUid: string;
  kind: RuleKind;
}

/** Rules of one kind directly in a folder, never those in its subfolders. */
export function FolderRuleCount({ folderUid, kind }: FolderRuleCountProps) {
  const { data, isError } = useGetFolderCountsQuery({ name: folderUid });

  if (data) {
    // The response omits resources the folder holds none of. getParsedCounts keeps the Unified Storage
    // entry over the SQL fallback one, so a rule is not counted twice.
    return <CountLabel kind={kind} count={getParsedCounts(data.counts)[COUNTS_RESOURCE[kind]] ?? 0} />;
  }
  if (isError) {
    return (
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="alerting.gma-rule-list.folder-row.count-unavailable">Count unavailable</Trans>
      </Text>
    );
  }
  return <Skeleton width={64} />;
}

function CountLabel({ kind, count }: { kind: RuleKind; count: number }) {
  const countLabel = ruleCountLabel(kind, count);
  const explanation = t(
    'alerting.gma-rule-list.folder-row.count-tooltip',
    'Rules directly in this folder. Subfolders are listed separately.'
  );
  // The span is not focusable, so the explanation is part of its name rather than only a hover tooltip.
  const accessibleName = t('alerting.gma-rule-list.folder-row.count-description', '{{label}}. {{explanation}}', {
    interpolation: { escapeValue: false },
    label: countLabel,
    explanation,
  });

  return (
    <Tooltip content={explanation}>
      <span role="img" aria-label={accessibleName}>
        <Text variant="bodySmall" color="secondary">
          {countLabel}
        </Text>
      </span>
    </Tooltip>
  );
}

const COUNTS_RESOURCE: Record<RuleKind, string> = { alert: 'alertrules', recording: 'recordingrules' };
