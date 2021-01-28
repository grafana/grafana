import React, { FunctionComponent } from 'react';
import { LokiQueryFieldForm, LokiQueryFieldFormProps } from './LokiQueryFieldForm';
import { useLokiLabels } from './useLokiLabels';
import LokiLanguageProvider from '../language_provider';

type LokiQueryFieldProps = Omit<
  LokiQueryFieldFormProps,
  'labelsLoaded' | 'onLoadOptions' | 'onLabelsRefresh' | 'logLabelOptions' | 'absoluteRange'
>;

export const LokiQueryField: FunctionComponent<LokiQueryFieldProps> = (props) => {
  const { datasource, range, ...otherProps } = props;
  const absoluteTimeRange = { from: range!.from!.valueOf(), to: range!.to!.valueOf() }; // Range here is never optional

  const { setActiveOption, refreshLabels, logLabelOptions, labelsLoaded } = useLokiLabels(
    datasource.languageProvider as LokiLanguageProvider,
    absoluteTimeRange
  );

  return (
    <LokiQueryFieldForm
      datasource={datasource}
      /**
       * setActiveOption name is intentional. Because of the way rc-cascader requests additional data
       * https://github.com/react-component/cascader/blob/master/src/Cascader.jsx#L165
       * we are notyfing useLokiSyntax hook, what the active option is, and then it's up to the hook logic
       * to fetch data of options that aren't fetched yet
       */
      onLoadOptions={setActiveOption}
      onLabelsRefresh={refreshLabels}
      absoluteRange={absoluteTimeRange}
      labelsLoaded={labelsLoaded}
      logLabelOptions={logLabelOptions}
      {...otherProps}
    />
  );
};

export default LokiQueryField;
