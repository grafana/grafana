import { Box, ClipboardButton, Stack, Text, Tooltip } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import ConditionalWrap from '../ConditionalWrap';

type DetailTextProps = {
  id: string;
  label: string;
  value: string | JSX.Element | null;
  /** Should the value be displayed using monospace font family? */
  monospace?: boolean;
  /** Optional string to display in a tooltip on hover of the value */
  tooltipValue?: string;
} & ConditionalProps;

type ConditionalProps =
  // Require either both copy props or neither
  | {
      /** Should we show a button for copying the value to clipboard? */
      showCopyButton: boolean;
      /**
       * Value to use for copying to clipboard, when enabled.
       * Needed as the value could be an element
       */
      copyValue: string;
    }
  | { showCopyButton?: never; copyValue?: never };

export const DetailText = ({
  id,
  label,
  value,
  monospace,
  showCopyButton,
  copyValue,
  tooltipValue,
}: DetailTextProps) => {
  const copyToClipboardLabel = t('alerting.copy-to-clipboard', 'Copy "{{label}}" to clipboard', { label });
  return (
    <Box>
      <Stack direction="column" gap={0}>
        <Text color="secondary" id={id}>
          {label}
        </Text>
        <Text aria-labelledby={id} color="primary" variant={monospace ? 'code' : 'body'}>
          <ConditionalWrap
            shouldWrap={Boolean(tooltipValue)}
            wrap={(children) => <Tooltip content={tooltipValue!}>{children}</Tooltip>}
          >
            <span>{value}</span>
          </ConditionalWrap>
          {showCopyButton && (
            <ClipboardButton
              aria-label={copyToClipboardLabel}
              fill="text"
              variant="secondary"
              icon="copy"
              size="sm"
              getText={() => copyValue}
            />
          )}
        </Text>
      </Stack>
    </Box>
  );
};
