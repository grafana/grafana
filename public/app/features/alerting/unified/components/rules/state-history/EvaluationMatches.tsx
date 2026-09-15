import { css } from '@emotion/css';

import { Trans } from '@grafana/i18n';
import { Stack, Text, useStyles2 } from '@grafana/ui';
import type { EvalMatch } from 'app/types/unified-alerting';

import { AlertLabel } from '../../AlertLabel';

interface Props {
  matches: EvalMatch[];
}

export function EvaluationMatches({ matches }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <Stack direction="column" gap={0.5}>
        {matches.map((match, index) => (
          <Stack key={`${match.refId ?? match.metric}-${index}`} direction="column" gap={0.5}>
            <Text variant="bodySmall">
              {match.refId ? `${match.refId}: ` : ''}
              {match.metric}
            </Text>
            <Stack gap={1} wrap="wrap">
              {Object.entries(match.labels ?? match.tags ?? {}).map(([labelKey, value]) => (
                <AlertLabel key={labelKey} labelKey={labelKey} value={value} />
              ))}
              <Text variant="bodySmall">
                <Trans i18nKey="alerting.state-history.evaluation-match-value">
                  value: {{ value: String(match.value ?? '') }}
                </Trans>
              </Text>
            </Stack>
          </Stack>
        ))}
      </Stack>
    </div>
  );
}

const getStyles = () => ({
  container: css({
    gridColumn: '1 / -1',
  }),
});
