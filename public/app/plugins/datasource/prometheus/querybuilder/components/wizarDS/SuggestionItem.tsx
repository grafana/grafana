import { cx } from '@emotion/css';
import React, { FormEvent, useState } from 'react';

import { SelectableValue } from '@grafana/data';
// import { reportInteraction } from '@grafana/runtime';
import { Button, RadioButtonList, Spinner, TextArea, Toggletip, useTheme2 } from '@grafana/ui';

import { getStyles } from './WizarDS';
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
};

const suggestionOptions: SelectableValue[] = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
];
const explationOptions: SelectableValue[] = [
  { label: 'Too vague', value: 'too vague' },
  { label: 'Too technical', value: 'too technical' },
  { label: 'Inaccurate', value: 'inaccurate' },
  { label: 'Other', value: 'other' },
];

export function SuggestionItem(props: Props) {
  const { suggestion, order, explain, historical, closeDrawer, last, allSuggestions, prompt } = props;
  const [showExp, updShowExp] = useState<boolean>(false);

  const [gaveExplanationFeedback, updateGaveExplanationFeedback] = useState<boolean>(false);
  const [gaveSuggestionFeedback, updateGaveSuggestionFeedback] = useState<boolean>(false);

  const [suggestionFeedback, setSuggestionFeedback] = useState({
    radioInput: '',
    text: '',
  });

  const [explanationFeedback, setExplanationFeedback] = useState({
    radioInput: '',
    text: '',
  });

  const theme = useTheme2();
  const styles = getStyles(theme);

  const { component, explanation, testid } = suggestion;

  const feedbackToggleTip = (type: string) => {
    const updateRadioFeedback = (value: string) => {
      if (type === 'explanation') {
        setExplanationFeedback({
          ...explanationFeedback,
          radioInput: value,
        });
      } else {
        setSuggestionFeedback({
          ...suggestionFeedback,
          radioInput: value,
        });
      }
    };

    const updateTextFeedback = (e: FormEvent<HTMLTextAreaElement>) => {
      if (type === 'explanation') {
        setExplanationFeedback({
          ...explanationFeedback,
          text: e.currentTarget.value,
        });
      } else {
        setSuggestionFeedback({
          ...suggestionFeedback,
          text: e.currentTarget.value,
        });
      }
    };

    const disabledButton = () =>
      type === 'explanation' ? !explanationFeedback.radioInput : !suggestionFeedback.radioInput;

    const questionOne =
      type === 'explanation' ? 'Why was the explanation not helpful?' : 'Were the suggestions helpful?';

    return (
      <div className={styles.suggestionFeedback}>
        <div>
          <div className={styles.feedbackQuestion}>
            <h6>{questionOne}</h6>
            <i>(Required)</i>
          </div>
          <RadioButtonList
            name="default"
            options={type === 'explanation' ? explationOptions : suggestionOptions}
            value={type === 'explanation' ? explanationFeedback.radioInput : suggestionFeedback.radioInput}
            onChange={updateRadioFeedback}
          />
        </div>
        <div className={cx(type === 'explanation' && styles.explationTextInput)}>
          {type !== 'explanation' && (
            <div className={styles.feedbackQuestion}>
              <h6>How can we improve the WizarDS?</h6>
            </div>
          )}
          <TextArea
            type="text"
            aria-label="Promqail suggestion text"
            placeholder="Enter your feedback"
            value={type === 'explanation' ? explanationFeedback.text : suggestionFeedback.text}
            onChange={updateTextFeedback}
            cols={100}
          />
        </div>

        <div className={styles.submitFeedback}>
          <Button
            variant="primary"
            size="sm"
            disabled={disabledButton()}
            onClick={() => {
              // submit the rudderstack event
              if (type === 'explanation') {
                explanationFeedbackEvent(
                  explanationFeedback.radioInput,
                  explanationFeedback.text,
                  suggestion,
                  historical,
                  prompt
                );
                updateGaveExplanationFeedback(true);
              } else {
                suggestionFeedbackEvent(
                  suggestionFeedback.radioInput,
                  suggestionFeedback.text,
                  allSuggestions ?? '',
                  historical,
                  prompt
                );
                updateGaveSuggestionFeedback(true);
              }
            }}
          >
            Submit
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={styles.suggestion}>
        <div title={component} className={cx(styles.codeText, styles.longCode)}>
          {`${order}.  ${component}`}
        </div>
        <div className={styles.useButton}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              // reportInteraction('grafana_prometheus_promqail_use_query_button_clicked', {
              //   query: querySuggestion.query,
              // });
              // const pvq = buildVisualQueryFromString(querySuggestion.query);
              // // check for errors!
              // onChange(pvq.query);
              // const els = document.querySelector(`[data-testid=${testid}]`) as HTMLElement;
              // els?.click();
              // closeDrawer();
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
              <div className={styles.textPadding}>{explanation}</div>
              <div className={styles.textPadding}>
                Learn more with this{' '}
                <a
                  className={styles.doc}
                  href={'https://prometheus.io/docs/prometheus/latest/querying/examples/#query-examples'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Prometheus doc
                </a>
              </div>

              <div className={cx(styles.rightButtons, styles.secondaryText)}>
                Was this explanation helpful?
                <div className={styles.floatRight}>
                  {!gaveExplanationFeedback ? (
                    <>
                      <Button
                        fill="outline"
                        variant="secondary"
                        size="sm"
                        className={styles.leftButton}
                        onClick={() => {
                          explanationFeedbackEvent('Yes', '', suggestion, historical, prompt);
                          updateGaveExplanationFeedback(true);
                        }}
                      >
                        Yes
                      </Button>
                      <Toggletip
                        aria-label="Suggestion feedback"
                        content={feedbackToggleTip('explanation')}
                        placement="bottom-end"
                        closeButton={true}
                      >
                        <Button variant="success" size="sm">
                          No
                        </Button>
                      </Toggletip>
                    </>
                  ) : (
                    'Thank you for your feedback!'
                  )}
                </div>
              </div>
            </div>

            {!last && <hr />}
          </>
        )}
        {last && (
          <div className={cx(styles.feedbackStyle)}>
            {!gaveSuggestionFeedback ? (
              <Toggletip
                aria-label="Suggestion feedback"
                content={feedbackToggleTip('suggestion')}
                placement="bottom-end"
                closeButton={true}
              >
                <Button fill="outline" variant="secondary" size="sm">
                  Give feedback on suggestions
                </Button>
              </Toggletip>
            ) : (
              // do this weird thing because the toggle tip doesn't allow an extra close function
              <Button fill="outline" variant="secondary" size="sm" disabled={true}>
                Thank you for your feedback!
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function explanationFeedbackEvent(
  radioInputFeedback: string,
  textFeedback: string,
  suggestion: Suggestion,
  historical: boolean,
  prompt: string
) {
  // const event = 'grafana_prometheus_promqail_explanation_feedback';
  // reportInteraction(event, {
  //   helpful: radioInputFeedback,
  //   textFeedback: textFeedback,
  //   suggestionType: historical ? 'historical' : 'AI',
  //   query: querySuggestion.component,
  //   explanation: querySuggestion.explanation,
  //   prompt: prompt,
  // });
}

function suggestionFeedbackEvent(
  radioInputFeedback: string,
  textFeedback: string,
  allSuggestions: string,
  historical: boolean,
  prompt: string
) {
  // const event = 'grafana_prometheus_promqail_suggestion_feedback';
  // reportInteraction(event, {
  //   helpful: radioInputFeedback,
  //   textFeedback: textFeedback,
  //   suggestionType: historical ? 'historical' : 'AI',
  //   allSuggestions: allSuggestions,
  //   prompt: prompt,
  // });
}
