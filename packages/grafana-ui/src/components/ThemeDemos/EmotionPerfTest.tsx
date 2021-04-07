/** @jsxImportSource @emotion/react */

import { Profiler, ProfilerOnRenderCallback, useState, FC } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useStyles, useTheme } from '../../themes';
import { Button } from '../Button';
import { VerticalGroup } from '../Layout/Layout';
import classnames from 'classnames';

export function EmotionPerfTest() {
  console.log('process.env.NODE_ENV', process.env.NODE_ENV);

  return (
    <VerticalGroup>
      <div>Emotion performance tests</div>
      <TestScenario name="No styles" Component={NoStyles} />
      <TestScenario name="inline emotion/css" Component={InlineEmotionCSS} />
      <TestScenario name="useStyles no cx" Component={UseStylesNoCX} />
      <TestScenario name="useStyles with conditional cx styles" Component={UseStylesWithConditionalCX} />
      <TestScenario name="useStyles with css prop" Component={UseStylesWithCSSProp} />
      <TestScenario name="useStyles with conditional css prop" Component={UseStylesWithConditionalCSS} />
      <TestScenario name="useStyles with conditional classnames" Component={UseStylesWithConditionalClassNames} />
    </VerticalGroup>
  );
}

export const TestScenario: FC<{ name: string; Component: FC<TestComponentProps> }> = ({ name, Component }) => {
  const [render, setRender] = useState(0);

  return (
    <div>
      <Button onClick={() => setRender(render > 2 ? 0 : render + 1)}>{name}</Button>
      {render > 0 && <MeasureRender id={name}>{renderManyComponents(Component)}</MeasureRender>}
    </div>
  );
};

TestScenario.displayName = 'TestScenario';

function renderManyComponents(Component: FC<TestComponentProps>) {
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < 5000; i++) {
    elements.push(<Component index={i} key={i.toString()} />);
  }

  return <div style={{ display: 'flex', flexWrap: 'wrap' }}>{elements}</div>;
}

interface TestComponentProps {
  index: number;
}

function UseStylesNoCX({ index }: TestComponentProps) {
  const styles = useStyles(getStyles);
  return (
    <div className={styles.main}>
      <div className={styles.child}>{index}</div>
    </div>
  );
}

function UseStylesWithConditionalCX({ index }: TestComponentProps) {
  const styles = useStyles(getStyles);
  const mainStyles = cx(styles.main, { [styles.large]: index > 10, [styles.disabed]: index % 10 === 0 });

  return (
    <div className={mainStyles}>
      <div className={styles.child}>{index}</div>
    </div>
  );
}

function UseStylesWithConditionalClassNames({ index }: TestComponentProps) {
  const styles = useStyles(getStyles);
  const mainStyles = classnames(styles.main, { [styles.large]: index > 10, [styles.disabed]: index % 10 === 0 });

  return (
    <div className={mainStyles}>
      <div className={styles.child}>{index}</div>
    </div>
  );
}

function UseStylesWithCSSProp({ index }: TestComponentProps) {
  const styles = useStyles(getStylesObjects);

  return (
    <div css={styles.main}>
      <div css={styles.child}>{index}</div>
    </div>
  );
}

function UseStylesWithConditionalCSS({ index }: TestComponentProps) {
  const styles = useStyles(getStylesObjects);
  const mainStyles = [styles.main, index > 10 && styles.large, index % 10 === 0 && styles.disabed];
  return (
    <div css={mainStyles}>
      <div css={styles.child}>{index}</div>
    </div>
  );
}

function InlineEmotionCSS({ index }: TestComponentProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.main}>
      <div className={styles.child}>{index}</div>
    </div>
  );
}

function NoStyles({ index }: TestComponentProps) {
  return (
    <div className="no-styles-main">
      <div className="no-styles-child">{index}</div>
    </div>
  );
}

function MeasureRender({ children, id }: { children: React.ReactNode; id: string }) {
  const onRender: ProfilerOnRenderCallback = (
    id: string,
    phase: 'mount' | 'update',
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
  ) => {
    console.log('Profile ' + id, actualDuration);
  };

  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}

const getStyles = (theme: GrafanaTheme) => {
  return {
    main: css(getStylesObjectMain(theme)),
    large: css({
      fontSize: '20px',
      color: 'red',
    }),
    disabed: css({
      fontSize: '10px',
      color: 'gray',
    }),
    child: css(getStylesObjectChild(theme)),
  };
};

const getStylesObjects = (theme: GrafanaTheme) => {
  return {
    main: getStylesObjectMain(theme),
    large: {
      fontSize: '20px',
      color: 'red',
    },
    disabed: {
      fontSize: '10px',
      color: 'gray',
    },
    child: getStylesObjectChild(theme),
  };
};

function getStylesObjectMain(theme: GrafanaTheme): any {
  return {
    background: 'blue',
    border: '1px solid red',
    color: 'white',
    padding: theme.v2.spacing(1),
    shadow: theme.v2.shadows.z1,
    ':hover': {
      background: theme.colors.bg1,
    },
  };
}

function getStylesObjectChild(theme: GrafanaTheme): any {
  return {
    padding: '2px',
    fontSize: '10px',
    boxShadow: 'none',
    textAlign: 'center',
    textDecoration: 'none',
  };
}
