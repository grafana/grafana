import React, { FunctionComponent } from 'react';
import { LokiQueryFieldForm, LokiQueryFieldFormProps } from './LokiQueryFieldForm';
import { useLokiSyntax } from './useLokiSyntax';
import LokiLanguageProvider from '../language_provider';

export const LokiQueryField: FunctionComponent<LokiQueryFieldFormProps> = ({ datasource, ...otherProps }) => {
  const { isSyntaxReady, setActiveOption, refreshLabels, ...syntaxProps } = useLokiSyntax(
    datasource.languageProvider as LokiLanguageProvider,
    otherProps.absoluteRange
  );

  return (
    <LokiQueryFieldForm
      datasource={datasource}
      syntaxLoaded={isSyntaxReady}
      /**
       * setActiveOption name is intentional. Because of the way rc-cascader requests additional data
       * https://github.com/react-component/cascader/blob/master/src/Cascader.jsx#L165
       * we are notyfing useLokiSyntax hook, what the active option is, and then it's up to the hook logic
       * to fetch data of options that aren't fetched yet
       */
      onLoadOptions={setActiveOption}
      onLabelsRefresh={refreshLabels}
      {...syntaxProps}
      {...otherProps}
    />
  );
};

export default LokiQueryField;
