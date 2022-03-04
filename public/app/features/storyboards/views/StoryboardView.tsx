import React, { FC, useMemo } from 'react';
import { css } from '@emotion/css';

import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { StoreState } from 'app/types';
import { connect } from 'react-redux';
import { useRunner, useSavedStoryboards } from '../hooks';
import {
  EvaluatedStoryboardDocument,
  Storyboard,
  StoryboardDocumentElement,
  UnevaluatedStoryboardDocument,
} from '../types';
import { getLocationSrv } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';

import { useObservable } from 'react-use';
import { ShowStoryboardDocumentElementEditor } from '../components/cells/StoryboardElementEditor';
import { ShowStoryboardDocumentElementResult } from '../components/cells/StoryboardElementResult';
import { evaluateDocument } from '../evaluate';
import { CellType } from '../components/cells/CellType';
import {
  Button,
  Card,
  IconButton,
  PageToolbar,
  ValuePicker,
  useTheme2,
  HorizontalGroup,
  useStyles2,
} from '@grafana/ui';
import { CellTypeIcon } from '../components/CellTypeIcon';
import { GrafanaTheme2 } from '@grafana/data';

interface StoryboardRouteParams {
  uid: string;
}

/// documents are a simple list of nodes. they can each be documentation, or code. cells can refer to
/// each-other's output, including data and text. some nodes produce realtime data.

const locationSrv = getLocationSrv();

interface StoryboardCellElementProps {
  element: StoryboardDocumentElement;
  index: number;
  board: Storyboard;
  addCellToBoard: (type: string, board: Storyboard, index?: number) => void;
  removeCellFromBoard: (board: Storyboard, index: number) => void;
  updateBoard: (board: Storyboard) => void;
  evaluation: EvaluatedStoryboardDocument;
}

const newCellOptions = [
  { label: 'Markdown cell', value: 'markdown' },
  { label: 'Query cell', value: 'query' },
  { label: 'Plot cell', value: 'timeseries-plot' },
  { label: 'Plain text cell', value: 'plaintext' },
  { label: 'Python cell', value: 'python' },
  { label: 'CSV cell', value: 'csv' },
];

const getStyles = (theme: GrafanaTheme2) => ({
  // Workaround: prefer if Card.Meta didn't use flex layout
  info: css`
    justify-content: space-between;
    align-items: center;
    width: 100%;
  `,
  metadata: css`
    align-items: center;
    width: 100%;
    font-size: ${theme.typography.size.sm};
    color: ${theme.colors.text.secondary};
    margin: ${theme.spacing(0.5, 0, 0)};
    line-height: ${theme.typography.bodySmall.lineHeight};
    overflow-wrap: anywhere;
  `,
});

const StoryboardCellElement = ({
  element,
  index,
  board,
  addCellToBoard,
  removeCellFromBoard,
  updateBoard,
  evaluation,
}: StoryboardCellElementProps) => {
  const styles = useStyles2(getStyles);
  // End workaround

  const addCell = (type: string) => addCellToBoard(type, board, index + 1);
  return (
    <Card
      heading=""
      className={css`
        background-color: transparent;
        & p,
        li {
          font-size: 16px;
        }
      `}
    >
      <Card.Figure>
        <CellTypeIcon type={element.type} aria-hidden />
      </Card.Figure>
      <Card.Meta className={styles.metadata}>
        <div>
          {(element.isEditorVisible || element.type === 'markdown') && (
            <ShowStoryboardDocumentElementEditor
              element={element}
              context={evaluation?.context}
              onUpdate={(newElement) => {
                let updatedDoc = board;
                updatedDoc.notebook.elements[index] = newElement;

                updateBoard(updatedDoc);
              }}
            />
          )}
          {element.isResultVisible && (
            <ShowStoryboardDocumentElementResult
              element={element}
              context={evaluation?.context}
              result={evaluation?.context[element.id]}
            />
          )}
          {element.type !== 'markdown' && element.type !== 'plaintext' && element.isResultVisible ? (
            <div>
              Result saved in variable: <CellType element={element} />
            </div>
          ) : null}
        </div>
      </Card.Meta>
      <Card.SecondaryActions>
        {element.type !== 'markdown' && element.type !== 'plaintext' ? (
          <>
            <Button
              onClick={() => {
                let newElement = { ...element };
                newElement.isEditorVisible = !element.isEditorVisible;
                let updatedDoc = board;
                updatedDoc.notebook.elements[index] = newElement;

                updateBoard(updatedDoc);
              }}
              variant="secondary"
              size="sm"
              icon={element.isEditorVisible ? 'eye-slash' : 'eye'}
            >{`${element.isEditorVisible ? 'Hide' : 'Show'} editor`}</Button>
            <Button
              onClick={() => {
                let newElement = { ...element };
                newElement.isResultVisible = !element.isResultVisible;
                let updatedDoc = board;
                updatedDoc.notebook.elements[index] = newElement;

                updateBoard(updatedDoc);
              }}
              variant="secondary"
              size="sm"
              icon={element.isResultVisible ? 'eye-slash' : 'eye'}
            >{`${element.isResultVisible ? 'Hide' : 'Show'} result`}</Button>
          </>
        ) : (
          <></>
        )}
        <ValuePicker
          options={newCellOptions}
          label="Add cell below"
          onChange={(value) => addCell(value.value!)}
          variant="secondary"
          isFullWidth={false}
        />
        <IconButton
          key="delete"
          name="trash-alt"
          tooltip="Delete this cell"
          onClick={() => removeCellFromBoard(board, index)}
        />
      </Card.SecondaryActions>
    </Card>
  );
};

export const StoryboardView: FC<StoryboardRouteParams> = ({ uid }) => {
  const { boards, updateBoard, addCellToBoard, removeCellFromBoard } = useSavedStoryboards();
  const board = boards.find((b) => b.uid === uid) as Storyboard;
  if (board === undefined) {
    locationSrv.update({ path: '/storyboards', partial: true });
    throw new TypeError('board is undefined');
  }

  const { title } = board as Storyboard;

  const runner = useRunner();
  const theme = useTheme2();
  const evaled = useMemo(
    () => evaluateDocument({ runner, theme, doc: board.notebook as UnevaluatedStoryboardDocument }),
    [runner, theme, board.notebook]
  );
  const evaluation = useObservable(evaled);

  return (
    <Page>
      <PageToolbar
        title={`Storyboards / ${title}`}
        onGoBack={() => locationSrv.update({ path: '/storyboards', partial: true })}
      >
        <Button icon="save">Save</Button>
      </PageToolbar>
      <Page.Contents>
        <div>
          <h2>{title}</h2>
          <hr />
          <div
            className={css`
              display: flex;
              flex-direction: column;
            `}
          >
            {evaluation?.elements.map((m, index) => (
              <div key={m.id}>
                <StoryboardCellElement
                  element={m}
                  index={index}
                  board={board}
                  addCellToBoard={addCellToBoard}
                  removeCellFromBoard={removeCellFromBoard}
                  updateBoard={updateBoard}
                  evaluation={evaluation}
                />
              </div>
            ))}
          </div>
          <HorizontalGroup justify="center">
            {newCellOptions.map((option) => (
              <Button
                key={option.value}
                variant="secondary"
                icon="plus"
                onClick={() => {
                  addCellToBoard(option.value, board);
                }}
              >
                {option.label}
              </Button>
            ))}
          </HorizontalGroup>
        </div>
      </Page.Contents>
    </Page>
  );
};

const mapStateToProps = (state: StoreState, props: GrafanaRouteComponentProps<StoryboardRouteParams>) => {
  return {
    uid: props.match.params.uid,
  };
};

export default connect(mapStateToProps)(StoryboardView);
