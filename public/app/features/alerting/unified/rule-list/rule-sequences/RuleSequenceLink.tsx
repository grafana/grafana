import { css } from '@emotion/css';
import { type MouseEvent } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { MetaText } from '../../components/MetaText';

interface RuleSequenceLinkProps {
  sequenceName: string;
  ruleUid: string;
  onClick: (sequenceName: string, ruleUid: string) => void;
}

export function RuleSequenceLink({ sequenceName, ruleUid, onClick }: RuleSequenceLinkProps) {
  const styles = useStyles2(getStyles);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onClick(sequenceName, ruleUid);
  }

  return (
    <MetaText icon="list-ol">
      <button
        type="button"
        className={styles.link}
        onClick={handleClick}
        aria-label={t('alerting.rule-sequence.link.label', 'Open rule sequence')}
      >
        <Trans i18nKey="alerting.rule-sequence.link.text">Rule sequence</Trans>
      </button>
    </MetaText>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    link: css({
      background: 'none',
      border: 'none',
      padding: 0,
      margin: 0,
      font: 'inherit',
      color: theme.colors.text.primary,
      cursor: 'pointer',
      '&:hover': {
        textDecoration: 'underline',
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.main}`,
        outlineOffset: '2px',
        borderRadius: theme.shape.radius.default,
      },
    }),
  };
}
