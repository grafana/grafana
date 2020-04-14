import React, { useContext } from 'react';
import { css } from 'emotion';
import { CustomScrollbar, Icon, JSONFormatter, ThemeContext } from '@grafana/ui';
import { GrafanaTheme, DataFrame } from '@grafana/data';

interface TransformationEditorProps {
  name: string;
  description: string;
  editor?: JSX.Element;
  input: DataFrame[];
  output?: DataFrame[];
  debugMode?: boolean;
}

export const TransformationEditor = ({ editor, input, output, debugMode }: TransformationEditorProps) => {
  const theme = useContext(ThemeContext);
  const styles = getStyles(theme);

  return (
    <div>
      <div className={styles.editor}>
        {editor}
        {debugMode && (
          <div className={styles.debugWrapper}>
            <div className={styles.debug}>
              <div className={styles.debugTitle}>Input</div>
              <div className={styles.debugJson}>
                <CustomScrollbar
                  className={css`
                    height: 100%;
                  `}
                >
                  <JSONFormatter json={input} />
                </CustomScrollbar>
              </div>
            </div>
            <div className={styles.debugSeparator}>
              <Icon name="arrow-right" />
            </div>
            <div className={styles.debug}>
              <div className={styles.debugTitle}>Output</div>

              <div className={styles.debugJson}>
                <CustomScrollbar
                  className={css`
                    height: 100%;
                  `}
                >
                  <JSONFormatter json={output} />
                </CustomScrollbar>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  title: css`
    display: flex;
    padding: 4px 8px 4px 8px;
    position: relative;
    height: 35px;
    background: ${theme.colors.textFaint};
    border-radius: 4px 4px 0 0;
    flex-wrap: nowrap;
    justify-content: space-between;
    align-items: center;
  `,
  name: css`
    font-weight: ${theme.typography.weight.semibold};
    color: ${theme.palette.blue};
  `,
  iconRow: css`
    display: flex;
  `,
  icon: css`
    background: transparent;
    border: none;
    box-shadow: none;
    cursor: pointer;
    color: ${theme.colors.textWeak};
    margin-left: ${theme.spacing.sm};
    &:hover {
      color: ${theme.colors.text};
    }
  `,
  editor: css`
    padding-top: ${theme.spacing.sm};
  `,
  debugWrapper: css`
    display: flex;
    flex-direction: row;
  `,
  debugSeparator: css`
    width: 48px;
    height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 ${theme.spacing.xs};
  `,
  debugTitle: css`
    padding: ${theme.spacing.xxs};
    text-align: center;
    font-family: ${theme.typography.fontFamily.monospace};
    font-size: ${theme.typography.size.sm};
    color: ${theme.palette.blueBase};
    border-bottom: 1px dashed ${theme.palette.gray15};
    flex-grow: 0;
    flex-shrink: 1;
  `,

  debug: css`
    margin-top: ${theme.spacing.md};
    padding: 0 ${theme.spacing.sm} ${theme.spacing.sm} ${theme.spacing.sm};
    border: 1px dashed ${theme.palette.gray15};
    background: ${theme.palette.gray05};
    border-radius: ${theme.border.radius.sm};
    width: 100%;
    height: 300px;
    display: flex;
    flex-direction: column;
  `,
  debugJson: css`
    flex-grow: 1;
    height: 100%;
    overflow: hidden;
  `,
});
