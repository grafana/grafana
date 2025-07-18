import { css, cx } from '@emotion/css';
import { components, GroupBase, SingleValueProps } from 'react-select';

import { GrafanaTheme2, SelectableValue, toIconName } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { useDelayedSwitch } from '../../utils/useDelayedSwitch';
import { Icon } from '../Icon/Icon';
import { Spinner } from '../Spinner/Spinner';
import { FadeTransition } from '../transitions/FadeTransition';
import { SlideOutTransition } from '../transitions/SlideOutTransition';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    singleValue: css({
      label: 'singleValue',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      boxSizing: 'border-box',
      maxWidth: '100%',
      gridArea: '1 / 1 / 2 / 3',
    }),
    spinnerWrapper: css({
      width: '16px',
      height: '16px',
      display: 'inline-block',
      marginRight: '10px',
      position: 'relative',
      verticalAlign: 'middle',
      overflow: 'hidden',
    }),
    spinnerIcon: css({
      width: '100%',
      height: '100%',
      position: 'absolute',
    }),
    optionIcon: css({
      marginRight: theme.spacing(1),
      color: theme.colors.text.secondary,
    }),
    disabled: css({
      color: theme.colors.text.disabled,
    }),
    isOpen: css({
      color: theme.colors.text.disabled,
    }),
  };
};

type StylesType = ReturnType<typeof getStyles>;

export type Props<T> = SingleValueProps<SelectableValue<T>, boolean, GroupBase<SelectableValue<T>>>;

export const SingleValue = <T extends unknown>(props: Props<T>) => {
  const { children, data, isDisabled } = props;
  const styles = useStyles2(getStyles);
  const loading = useDelayedSwitch(data.loading || false, { delay: 250, duration: 750 });
  const icon = data.icon ? toIconName(data.icon) : undefined;

  return (
    <components.SingleValue
      {...props}
      className={cx(styles.singleValue, isDisabled && styles.disabled, props.selectProps.menuIsOpen && styles.isOpen)}
    >
      {data.imgUrl ? (
        <FadeWithImage loading={loading} imgUrl={data.imgUrl} styles={styles} alt={String(data.label ?? data.value)} />
      ) : (
        <>
          <SlideOutTransition horizontal size={16} visible={loading} duration={150}>
            <div className={styles.spinnerWrapper}>
              <Spinner className={styles.spinnerIcon} inline />
            </div>
          </SlideOutTransition>
          {icon && <Icon name={icon} role="img" className={styles.optionIcon} />}
        </>
      )}

      {!data.hideText && children}
    </components.SingleValue>
  );
};

const FadeWithImage = (props: { loading: boolean; imgUrl: string; styles: StylesType; alt?: string }) => {
  return (
    <div className={props.styles.spinnerWrapper}>
      <FadeTransition duration={150} visible={props.loading}>
        <Spinner className={props.styles.spinnerIcon} inline />
      </FadeTransition>
      <FadeTransition duration={150} visible={!props.loading}>
        <img className={props.styles.spinnerIcon} src={props.imgUrl} alt={props.alt} />
      </FadeTransition>
    </div>
  );
};
