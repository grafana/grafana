import React, { useState } from 'react';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { StoryboardList } from '../components/StoryboardList';
import { useSavedStoryboards } from '../hooks';
import { Button, VerticalGroup } from '@grafana/ui';
import { StoryboardForm } from '../components/StoryboardForm';
import { v4 as uuidv4 } from 'uuid';
import { getLocationSrv } from '@grafana/runtime';
import { UnevaluatedStoryboardDocument } from '../types';

const locationSrv = getLocationSrv();

export const StoryboardListView = () => {
  const navModel = useNavModel('storyboards');
  const [isCreatingBoard, setIsCreating] = useState(false);
  const { boards, createBoard, removeBoard } = useSavedStoryboards();

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <VerticalGroup>
          {isCreatingBoard ? (
            <StoryboardForm
              onSubmit={(values) => {
                const uid = uuidv4();
                createBoard({ ...values, uid, notebook: DEFAULT_DOCUMENT });
                //Reroute to /storyboards/uid
                locationSrv.update({
                  partial: true,
                  path: `/storyboards/${uid}`,
                });
              }}
              onCancel={() => setIsCreating(false)}
            />
          ) : (
            <Button icon="plus" onClick={() => setIsCreating(true)}>
              Create Storyboard
            </Button>
          )}
          <StoryboardList boards={boards} onRemove={(boardId) => removeBoard(boardId)} />
        </VerticalGroup>
      </Page.Contents>
    </Page>
  );
};

export const DEFAULT_DOCUMENT: UnevaluatedStoryboardDocument = {
  title: 'DEFAULT_DOCUMENT',
  status: 'unevaluated',
  elements: [
    // presentational markdown
    {
      id: 'markdown',
      type: 'markdown',
      content: '# This is markdown\n\n*Click* me to edit',
      editing: false,
      isEditorVisible: true,
      isResultVisible: true,
    },

    // Directly embed csv
    {
      id: 'some_data',
      type: 'csv',
      content: {
        text: 'a,b,c\n3,2,1\n4,5,6\n',
      },
      isEditorVisible: true,
      isResultVisible: true,
    },

    // Fetch data from remote url and expose result
    // { id: 'fetched', type: 'fetch', url: './works.csv' },

    // Perform a query and put data into local context
    {
      id: 'query',
      type: 'query',
      datasourceUid: '_yxMP8Ynk',
      query: { refId: 'query', expr: 'go_goroutines' },
      timeRange: { from: '2021-07-01T09:00:00', to: '2021-07-01T15:00:00' },

      isEditorVisible: true,
      isResultVisible: true,
    },
    {
      id: 'query2',
      type: 'query',
      datasourceUid: '_yxMP8Ynk',
      query: { refId: 'query2', expr: 'prometheus_engine_queries' },
      timeRange: { from: '2021-07-01T09:00:00', to: '2021-07-01T15:00:00' },
      isEditorVisible: true,
      isResultVisible: true,
    },

    // Show a timeseries
    { id: 'presentation', type: 'timeseries-plot', from: 'query', isEditorVisible: true, isResultVisible: true },

    // raw json data
    // {
    //   id: 'rawtime',
    //   type: 'json',
    //   content: [
    //     { time: 1, value: 123 },
    //     { time: 2, value: 124 },
    //   ],
    // },
    //
    {
      id: 'compute1',
      type: 'python',
      script: `from js import some_data;
int(DF(some_data)["a"][0])`,

      isEditorVisible: true,
      isResultVisible: true,
      returnsDF: true,
    },
    {
      id: 'compute2',
      type: 'python',
      script: `from js import compute1;
print(f"Compute 1 is {compute1}, whose value squared is {compute1**2}");
compute1 + 42`,
      isEditorVisible: true,
      isResultVisible: true,
      returnsDF: false,
    },
  ],
};

export default StoryboardListView;
