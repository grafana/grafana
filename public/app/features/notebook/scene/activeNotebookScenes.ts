import { type NotebookScene } from './NotebookScene';

// Only mounted scenes: the page's scene cache also keeps ones nobody is looking at.
const activeScenes: NotebookScene[] = [];

export function registerActiveNotebookScene(scene: NotebookScene): () => void {
  activeScenes.push(scene);
  return () => {
    const index = activeScenes.lastIndexOf(scene);
    if (index !== -1) {
      activeScenes.splice(index, 1);
    }
  };
}

/** The most recently mounted scene showing this notebook. Uid is read now: a draft gets one on first save. */
export function findActiveNotebookScene(uid: string): NotebookScene | undefined {
  for (let index = activeScenes.length - 1; index >= 0; index--) {
    if (activeScenes[index].state.uid === uid) {
      return activeScenes[index];
    }
  }
  return undefined;
}
