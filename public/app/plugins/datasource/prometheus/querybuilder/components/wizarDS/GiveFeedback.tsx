import { css, cx } from '@emotion/css';
import React, { FormEvent, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, RadioButtonList, TextArea, Toggletip, useStyles2 } from '@grafana/ui';

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

type GiveFeedbackProps = {
  context?: any;
};

// TODO: HOOK UP PROPERLY
export const GiveFeedback = ({ context }: GiveFeedbackProps) => {
  const [gaveExplanationFeedback, updateGaveExplanationFeedback] = useState<boolean>(false);
  const styles = useStyles2(getStyles);

  const [suggestionFeedback, setSuggestionFeedback] = useState({
    radioInput: '',
    text: '',
  });

  const [explanationFeedback, setExplanationFeedback] = useState({
    radioInput: '',
    text: '',
  });

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
            aria-label="WizarDS suggestion text"
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
            onClick={() =>
              explanationFeedbackEvent({
                useful: false,
                context,
                explanationFeedbackEvent,
              })
            }
          >
            Submit
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className={cx(styles.rightButtons, styles.secondaryText)}>
      Was this explanation helpful?
      <div className={styles.floatRight}>
        {!gaveExplanationFeedback ? (
          <>
            <Button
              fill="outline"
              variant="secondary"
              size="sm"
              onClick={() => {
                explanationFeedbackEvent({ useful: true, context });
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
  );
};

function explanationFeedbackEvent({ useful, context, feedback }: any) {}

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
