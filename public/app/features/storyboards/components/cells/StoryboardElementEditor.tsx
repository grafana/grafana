import React from 'react';
import { InlineSwitch, TextArea, Tooltip, Field, TableInputCSV, CodeEditor, Select, IconButton } from '@grafana/ui';
import { renderMarkdown } from '@grafana/data';

import { StoryboardDatasourceQueryEditor } from './StoryboardDatasourceQueryEditor';
import { StoryboardContext, StoryboardDocumentElement } from '../../types';
import { css } from '@emotion/css';

interface Props {
  element: StoryboardDocumentElement;
  context: StoryboardContext;
  onUpdate: (element: StoryboardDocumentElement) => void;
}

export function ShowStoryboardDocumentElementEditor({ element, context, onUpdate }: Props): JSX.Element {
  switch (element.type) {
    case 'markdown': {
      return (
        <Field>
          <div
            className={css`
              display: flex;
              justify-content: space-between;
            `}
          >
            {element.editing || element.content.trim() === '' ? (
              <div className="gf-form--grow">
                <TextArea
                  defaultValue={element.content}
                  className="gf-form-input"
                  onBlur={(event) => {
                    element.editing = false;
                    let newElement = element;
                    newElement.content = event.currentTarget.value;
                    onUpdate(newElement);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && event.shiftKey) {
                      element.editing = false;
                      let newElement = element;
                      newElement.content = event.currentTarget.value;
                      onUpdate(newElement);
                    }
                  }}
                />
              </div>
            ) : (
              <div
                className="gf-form--grow"
                dangerouslySetInnerHTML={
                  // we should parse markdown with a strict subset of options directly to JSX with a library like this:
                  // https://github.com/rexxars/commonmark-react-renderer
                  { __html: renderMarkdown((element.content as string) || '') }
                }
                onClick={() => {
                  element.editing = true;
                  onUpdate(element);
                }}
              />
            )}
            <IconButton
              size="lg"
              name={element.editing ? 'x' : 'pen'}
              onClick={() => {
                element.editing = !element.editing;
                onUpdate(element);
              }}
            />
          </div>
        </Field>
      );
    }
    case 'csv': {
      return (
        <TableInputCSV
          width="100%"
          height="100px"
          text={element.content.text}
          onSeriesParsed={(data, text) => {
            let newElement = element;
            newElement.content.data = data;
            newElement.content.text = text;
            onUpdate(newElement);
          }}
        />
      );
    }
    case 'plaintext': {
      return <pre>{element.content}</pre>;
    }
    case 'python': {
      return (
        <div>
          <Tooltip
            content={`Check this box if your Python code returns a DataFrame.
            Convert Pandas Dataframes with the toDF function!

            Only cells returning DataFrames can be used in timeseries plots. These DataFrames
            must have a 'Time' column containing pd.Timestamps, and any number of other columns.`}
          >
            <span>
              <InlineSwitch
                label="Cell returns DataFrame?"
                showLabel={true}
                value={element.returnsDF ?? false}
                onChange={(e) => {
                  let newElement = element;
                  newElement.returnsDF = e.currentTarget.checked;
                  onUpdate(newElement);
                }}
              />
            </span>
          </Tooltip>
          <CodeEditor
            value={element.script}
            language="python"
            height={200}
            showLineNumbers
            onBlur={(newCode) => {
              if (newCode !== element.script) {
                let newElement = element;
                newElement.script = newCode;
                onUpdate(newElement);
              }
            }}
          />
        </div>
      );
    }
    case 'query': {
      return (
        <StoryboardDatasourceQueryEditor
          datasourceUid={element.datasourceUid}
          onChangeDatasource={(newDatasource) => {
            let newElement = { ...element };
            newElement.datasourceUid = newDatasource;
            onUpdate(newElement);
          }}
          query={element.query}
          onChangeQuery={(newQuery) => {
            let newElement = { ...element };
            newElement.query = newQuery;
            onUpdate(newElement);
          }}
          timeRange={element.timeRange}
          onChangeTimeRange={(range) => {
            let newElement = { ...element };
            newElement.timeRange = range;
            onUpdate(newElement);
          }}
        />
      );
    }
    case 'timeseries-plot': {
      const options = Object.entries(context)
        .filter(
          ([k, v]) => v.element?.type === 'query' || (v.element?.type === 'python' && v.element?.returnsDF === true)
        )
        .map(([k, v]) => ({ label: k, value: k }));
      return (
        <Select
          value={element.from}
          options={options}
          placeholder="Select a query"
          onChange={(value) => {
            if (value.value != null) {
              let newElement = element;
              newElement.from = value.value;
              onUpdate(newElement);
            }
          }}
        />
      );
    }
  }
  return <>{JSON.stringify(element)}</>;
}
