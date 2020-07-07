import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';
import { Field, LinkModel, LogLabelStatsModel, GrafanaTheme } from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import { stylesFactory } from '../../themes/stylesFactory';

//Components
import { LogLabelStats } from './LogLabelStats';
import { IconButton } from '../IconButton/IconButton';
import { Tag } from '..';

export interface Props extends Themeable {
  parsedValue: string;
  parsedKey: string;
  isLabel?: boolean;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  links?: Array<LinkModel<Field>>;
  getStats: () => LogLabelStatsModel[] | null;
}

interface State {
  showFieldsStats: boolean;
  fieldCount: number;
  fieldStats: LogLabelStatsModel[] | null;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    noHoverBackground: css`
      label: noHoverBackground;
      :hover {
        background-color: transparent;
      }
    `,
    hoverCursor: css`
      label: hoverCursor;
      cursor: pointer;
    `,
    wordBreakAll: css`
      label: wordBreakAll;
      word-break: break-all;
    `,
  };
});

class UnThemedLogDetailsRow extends PureComponent<Props, State> {
  state: State = {
    showFieldsStats: false,
    fieldCount: 0,
    fieldStats: null,
  };

  filterLabel = () => {
    const { onClickFilterLabel, parsedKey, parsedValue } = this.props;
    if (onClickFilterLabel) {
      onClickFilterLabel(parsedKey, parsedValue);
    }
  };

  filterOutLabel = () => {
    const { onClickFilterOutLabel, parsedKey, parsedValue } = this.props;
    if (onClickFilterOutLabel) {
      onClickFilterOutLabel(parsedKey, parsedValue);
    }
  };

  showStats = () => {
    const { showFieldsStats } = this.state;
    if (!showFieldsStats) {
      const fieldStats = this.props.getStats();
      const fieldCount = fieldStats ? fieldStats.reduce((sum, stat) => sum + stat.count, 0) : 0;
      this.setState({ fieldStats, fieldCount });
    }
    this.toggleFieldsStats();
  };

  toggleFieldsStats() {
    this.setState(state => {
      return {
        showFieldsStats: !state.showFieldsStats,
      };
    });
  }

  render() {
    const { theme, parsedKey, parsedValue, isLabel, links } = this.props;
    const { showFieldsStats, fieldStats, fieldCount } = this.state;
    const styles = getStyles(theme);
    const style = getLogRowStyles(theme);
    return (
      <tr className={cx(style.logDetailsValue, { [styles.noHoverBackground]: showFieldsStats })}>
        {/* Action buttons - show stats/filter results */}
        <td className={style.logsDetailsIcon} colSpan={isLabel ? undefined : 3}>
          <IconButton name="signal" title={'Ad-hoc statistics'} onClick={this.showStats} />
        </td>

        {isLabel && (
          <>
            <td className={style.logsDetailsIcon}>
              <IconButton name="search-plus" title="Filter for value" onClick={this.filterLabel} />
            </td>
            <td className={style.logsDetailsIcon}>
              <IconButton name="search-minus" title="Filter out value" onClick={this.filterOutLabel} />
            </td>
          </>
        )}

        {/* Key - value columns */}
        <td className={style.logDetailsLabel}>{parsedKey}</td>
        <td className={styles.wordBreakAll}>
          {parsedValue}
          {links &&
            links.map(link => {
              return (
                <>
                  &nbsp;
                  <FieldLink link={link} />
                </>
              );
            })}
          {showFieldsStats && (
            <LogLabelStats
              stats={fieldStats!}
              label={parsedKey}
              value={parsedValue}
              rowCount={fieldCount}
              isLabel={isLabel}
            />
          )}
        </td>
      </tr>
    );
  }
}

const getLinkStyles = stylesFactory(() => {
  return {
    tag: css`
      margin-left: 6px;
      font-size: 11px;
      padding: 2px 6px;
    `,
  };
});

type FieldLinkProps = {
  link: LinkModel<Field>;
};
function FieldLink({ link }: FieldLinkProps) {
  const styles = getLinkStyles();
  return (
    <a
      href={link.href}
      target={'_blank'}
      onClick={
        link.onClick
          ? event => {
              if (!(event.ctrlKey || event.metaKey || event.shiftKey) && link.onClick) {
                event.preventDefault();
                link.onClick(event);
              }
            }
          : undefined
      }
    >
      <Tag name={link.title} className={styles.tag} colorIndex={6} />
    </a>
  );
}

export const LogDetailsRow = withTheme(UnThemedLogDetailsRow);
LogDetailsRow.displayName = 'LogDetailsRow';
