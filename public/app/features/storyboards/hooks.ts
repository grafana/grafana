import { useEffect, useState, useMemo } from 'react';
import { createQueryRunner } from '@grafana/runtime';
import { createStoryboard, getStoryboards, removeStoryboard, updateStoryboard } from './storage';
import { Storyboard, StoryboardDocumentElement } from './types';

export function useSavedStoryboards() {
  let [boards, setBoards] = useState<Storyboard[]>(getStoryboards());

  const updateBoardState = () => {
    const newBoards = getStoryboards();
    setBoards(newBoards);
  };

  const updateBoard = (board: Storyboard) => {
    updateStoryboard(board);
    updateBoardState();
  };

  const removeBoard = (boardId: string) => {
    removeStoryboard(boardId);
    updateBoardState();
  };

  const createBoard = (board: Storyboard) => {
    createStoryboard(board);
    updateBoardState();
  };

  const addCellToBoard = (type: string, board: Storyboard, index: number | null = null) => {
    const nextId = findNextIdForCellType(type, board);
    let cell: StoryboardDocumentElement | null = null;
    switch (type) {
      case 'markdown':
        cell = {
          id: 'markdown' + nextId,
          type: 'markdown',
          content: '',
          editing: true,
          isEditorVisible: true,
          isResultVisible: true,
        };
        break;
      case 'csv':
        cell = {
          id: 'csv' + nextId,
          type: 'csv',
          content: {
            text: '',
          },
          isEditorVisible: true,
          isResultVisible: true,
        };
        break;
      case 'query':
        const id = 'query' + nextId;
        cell = {
          id,
          type: 'query',
          datasourceUid: null,
          query: {
            refId: id,
          },
          isEditorVisible: true,
          isResultVisible: true,
          timeRange: { from: '2021-07-01T09:00:00', to: '2021-07-01T15:00:00' },
        };
        break;
      case 'plaintext':
        cell = {
          id: 'plaintext' + nextId,
          type: 'plaintext',
          content: '',
          isEditorVisible: true,
          isResultVisible: true,
        };
        break;
      case 'python':
        cell = {
          id: 'python' + nextId,
          type: 'python',
          script: '',
          returnsDF: false,
          isEditorVisible: true,
          isResultVisible: true,
        };
        break;
      case 'timeseries-plot':
        cell = {
          id: 'timeseries-plot' + nextId,
          type: 'timeseries-plot',
          from: '',
          isEditorVisible: true,
          isResultVisible: true,
        };
        break;
      default:
        throw new Error('bad element type:' + type);
    }
    if (index == null) {
      board.notebook.elements.push(cell as StoryboardDocumentElement);
    } else {
      board.notebook.elements.splice(index, 0, cell as StoryboardDocumentElement);
    }
    updateBoard(board);
  };

  const removeCellFromBoard = (board: Storyboard, index: number) => {
    board.notebook.elements.splice(index, 1);
    updateBoard(board);
  };

  return { boards, updateBoard, createBoard, removeBoard, addCellToBoard, removeCellFromBoard };
}

export function useRunner() {
  const runner = useMemo(() => createQueryRunner(), []);

  useEffect(() => {
    const toDestroy = runner;
    return () => {
      return toDestroy.destroy();
    };
  }, [runner]);

  return runner;
}

function findNextIdForCellType(type: string, board: Storyboard) {
  // Scans the list of elements for their IDs of form "${type}${id}" to find a next unique id
  const elements = board.notebook.elements;

  const ids = Array.from(elements, (element) => element.id)
    .filter((id) => id.startsWith(type))
    .map((id) => Number(id.slice(type.length)));

  if (ids.length > 0) {
    return Math.max(...ids) + 1;
  } else {
    return 0;
  }
}
