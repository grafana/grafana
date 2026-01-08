import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { getInternalRadius, getExternalRadius } from '../../themes/mixins';
import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';

interface DemoBoxProps {
  referenceBorderRadius: number;
  referenceBorderWidth: number;
  offset: number;
  borderWidth: number;
}

export const BorderRadiusContainer = ({
  referenceBorderRadius,
  referenceBorderWidth,
  offset,
  borderWidth,
}: DemoBoxProps) => {
  const styles = useStyles2(getStyles, referenceBorderRadius, referenceBorderWidth, offset, borderWidth);
  return (
    <Stack direction="column" alignItems="center" gap={4}>
      <Stack alignItems="center">
        {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
        <Text variant="code">getInternalRadius</Text>
        <div className={styles.baseForInternal}>
          <div className={styles.internalContainer} />
        </div>
      </Stack>
      <Stack alignItems="center">
        {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
        <Text variant="code">getExternalRadius</Text>
        <div className={styles.externalContainer}>
          <div className={styles.baseForExternal} />
        </div>
      </Stack>
    </Stack>
  );
};

const getStyles = (
  theme: GrafanaTheme2,
  referenceBorderRadius: number,
  referenceBorderWidth: number,
  offset: number,
  borderWidth: number
) => ({
  baseForInternal: css({
    backgroundColor: theme.colors.action.disabledBackground,
    border: `${referenceBorderWidth}px dashed ${theme.colors.action.disabledText}`,
    borderRadius: referenceBorderRadius,
    display: 'flex',
    height: '80px',
    padding: offset,
    width: '300px',
  }),
  baseForExternal: css({
    backgroundColor: theme.colors.action.disabledBackground,
    border: `${referenceBorderWidth}px dashed ${theme.colors.action.disabledText}`,
    borderRadius: referenceBorderRadius,
    height: '80px',
    flex: 1,
    width: '300px',
  }),
  internalContainer: css({
    backgroundColor: theme.colors.background.primary,
    border: `${borderWidth}px solid ${theme.colors.primary.main}`,
    borderRadius: getInternalRadius(theme, offset, {
      parentBorderRadius: referenceBorderRadius,
      parentBorderWidth: referenceBorderWidth,
    }),
    flex: 1,
  }),
  externalContainer: css({
    border: `${borderWidth}px solid ${theme.colors.primary.main}`,
    borderRadius: getExternalRadius(theme, offset, {
      childBorderRadius: referenceBorderRadius,
      selfBorderWidth: borderWidth,
    }),
    display: 'flex',
    flex: 1,
    padding: offset,
  }),
});
