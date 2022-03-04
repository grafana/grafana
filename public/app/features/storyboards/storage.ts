import store from 'app/core/store';
import { Storyboard } from './types';

const STORAGE_KEY = 'grafana.storyboards';

export const getStoryboards = (): Storyboard[] => {
  return store.getObject(STORAGE_KEY) || [];
};

export const updateStoryboard = (newBoard: Storyboard) => {
  let boards = getStoryboards();
  for (let i = 0; i < boards.length; i++) {
    if (boards[i].uid === newBoard.uid) {
      boards[i] = newBoard;
    }
  }
  store.setObject(STORAGE_KEY, boards);
};

export const createStoryboard = (newBoard: Storyboard) => {
  let boards = getStoryboards();
  boards.push(newBoard);
  store.setObject(STORAGE_KEY, boards);
};

export const removeStoryboard = (boardId: string) => {
  let boards = getStoryboards();
  const newBoards = boards.filter((board) => board.uid !== boardId);
  store.setObject(STORAGE_KEY, newBoards);
};
