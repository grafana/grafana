import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Dropdown, Menu, useStyles2 } from '@grafana/ui';

import { byPackageGradient, byValueGradient, diffColorBlindGradient, diffDefaultGradient } from './FlameGraph/colors';
import { ColorScheme, ColorSchemeDiff } from './types';

type ColorSchemeButtonProps = {
  value: ColorScheme | ColorSchemeDiff;
  onChange: (colorScheme: ColorScheme | ColorSchemeDiff) => void;
  isDiffMode: boolean;
};

export function ColorSchemeButton(props: ColorSchemeButtonProps) {
  const styles = useStyles2(getStyles);
  let menu = (
    <Menu>
      <Menu.Item label="By package name" onClick={() => props.onChange(ColorScheme.PackageBased)} />
      <Menu.Item label="By value" onClick={() => props.onChange(ColorScheme.ValueBased)} />
    </Menu>
  );

  // Show a bit different gradient as a way to indicate selected value
  const colorDotStyle =
    {
      [ColorScheme.ValueBased]: styles.colorDotByValue,
      [ColorScheme.PackageBased]: styles.colorDotByPackage,
      [ColorSchemeDiff.DiffColorBlind]: styles.colorDotDiffColorBlind,
      [ColorSchemeDiff.Default]: styles.colorDotDiffDefault,
    }[props.value] || styles.colorDotByValue;

  let contents = <span className={cx(styles.colorDot, colorDotStyle)} />;

  if (props.isDiffMode) {
    menu = (
      <Menu>
        <Menu.Item label="Default (green to red)" onClick={() => props.onChange(ColorSchemeDiff.Default)} />
        <Menu.Item label="Color blind (blue to red)" onClick={() => props.onChange(ColorSchemeDiff.DiffColorBlind)} />
      </Menu>
    );

    contents = (
      <div className={cx(styles.colorDotDiff, colorDotStyle)}>
        <div>-100% (removed)</div>
        <div>0%</div>
        <div>+100% (added)</div>
      </div>
    );
  }

  return (
    <Dropdown overlay={menu}>
      <Button
        variant={'secondary'}
        fill={'outline'}
        size={'sm'}
        tooltip={'Change color scheme'}
        onClick={() => {}}
        className={styles.buttonSpacing}
        aria-label={'Change color scheme'}
      >
        {contents}
      </Button>
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  buttonSpacing: css({
    label: 'buttonSpacing',
    marginRight: theme.spacing(1),
  }),
  colorDot: css({
    label: 'colorDot',
    display: 'inline-block',
    width: '10px',
    height: '10px',
    borderRadius: theme.shape.radius.circle,
  }),
  colorDotDiff: css({
    label: 'colorDotDiff',
    display: 'flex',
    width: '200px',
    height: '12px',
    color: 'white',
    fontSize: 9,
    lineHeight: 1.3,
    fontWeight: 300,
    justifyContent: 'space-between',
    padding: '0 2px',
    // eslint-disable-next-line @grafana/no-border-radius-literal
    borderRadius: '2px',
  }),
  colorDotByValue: css({
    label: 'colorDotByValue',
    background: byValueGradient,
  }),
  colorDotByPackage: css({
    label: 'colorDotByPackage',
    background: byPackageGradient,
  }),
  colorDotDiffDefault: css({
    label: 'colorDotDiffDefault',
    background: diffDefaultGradient,
  }),
  colorDotDiffColorBlind: css({
    label: 'colorDotDiffColorBlind',
    background: diffColorBlindGradient,
  }),
});
