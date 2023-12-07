import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Spinner, useStyles2 } from '@grafana/ui';
import { addTutorial, startTutorial } from 'app/features/tutorial/slice';
import { useDispatch } from 'app/types';

import { GiveFeedback } from './GiveFeedback';
import { Suggestion } from './types';

export type Props = {
  suggestion: Suggestion;
  order: number;
  explain: (idx: number) => void;
  historical: boolean;
  closeDrawer: () => void;
  last: boolean;
  prompt: string;
  allSuggestions: string | undefined;
  chosenLLM: string;
};

export function SuggestionItem(props: Props) {
  const dispatch = useDispatch();
  const { suggestion, order, explain, last, chosenLLM } = props;
  const [showExp, updShowExp] = useState<boolean>(false);
  const styles = useStyles2(getStyles);
  const { component, explanation /* testid, order, link */ } = suggestion;

  return (
    <>
      <div className={styles.suggestion}>
        <div title={component} className={cx(styles.codeText, styles.longCode)}>
          {`${order}.  ${component}`}
        </div>
        <div className={styles.useButton}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const tutorialid = `component-locator`;
              dispatch(
                addTutorial({
                  id: tutorialid,
                  name: `Individual Component`,
                  description: ``,
                  author: `Query Wizard - ${chosenLLM}`,
                  steps: [props.suggestion],
                })
              );
              dispatch(startTutorial(tutorialid));
            }}
          >
            Where is it?
          </Button>
        </div>
      </div>
      <div>
        <Button
          fill="text"
          variant="secondary"
          icon={showExp ? 'angle-up' : 'angle-down'}
          onClick={() => {
            updShowExp(!showExp);
            explain(order - 1);
          }}
          className={cx(styles.bodySmall)}
          size="sm"
        >
          Explainer
        </Button>
        {!showExp && order !== 5 && <div className={styles.textPadding}></div>}

        {showExp && !suggestion.explanation && (
          <div className={styles.center}>
            <Spinner />
          </div>
        )}
        {showExp && suggestion.explanation && (
          <>
            <div className={cx(styles.bodySmall, styles.explainPadding)}>
              <p>{explanation}</p>
              <p>
                <a className={styles.doc} href={suggestion.link} target="_blank" rel="noopener noreferrer">
                  Learn more
                </a>
              </p>
              <GiveFeedback />
            </div>

            {!last && <hr />}
          </>
        )}
      </div>
    </>
  );
}
const getStyles = (theme: GrafanaTheme2) => ({
  explationTextInput: css({
    paddingLeft: '24px',
  }),
  useButton: css({
    marginLeft: 'auto',
  }),
  suggestionFeedback: css({
    textAlign: 'left',
  }),

  submitFeedback: css({
    padding: '16px 0',
  }),
  suggestion: css({
    display: 'flex',
    flexWrap: 'nowrap',
  }),
  feedbackQuestion: css({
    display: 'flex',
    padding: '8px 0px',
    h6: { marginBottom: 0 },
    i: {
      marginTop: '1px',
    },
  }),

  longCode: css({
    width: '90%',
    textWrap: 'nowrap',
    overflow: 'scroll',
    maskImage: `linear-gradient(to right, rgba(0, 0, 0, 1) 90%, rgba(0, 0, 0, 0))`,

    div: {
      display: 'inline-block',
    },
  }),
  floatRight: css({
    float: 'right',
  }),
  secondaryText: css({
    color: theme.colors.text.secondary,
  }),
  bodySmall: css({
    fontSize: `${theme.typography.bodySmall.fontSize}`,
  }),

  codeText: css({
    fontFamily: `${theme.typography.fontFamilyMonospace}`,
    fontSize: `${theme.typography.bodySmall.fontSize}`,
  }),
  feedbackStyle: css({
    margin: 0,
    textAlign: 'right',
    paddingTop: '22px',
    paddingBottom: '22px',
  }),

  explainPadding: css({
    paddingLeft: '26px',
  }),
  doc: css({
    textDecoration: 'underline',
  }),

  rightButtons: css({
    display: 'flex',
    flexWrap: `nowrap`,
    marginLeft: 'auto',
  }),
  textPadding: css({
    paddingBottom: '12px',
  }),

  center: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
});
