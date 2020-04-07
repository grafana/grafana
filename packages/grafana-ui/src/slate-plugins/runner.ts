import { Plugin } from '@grafana/slate-react';
import { Editor as CoreEditor } from 'slate';

export function RunnerPlugin({ handler }: any): Plugin {
  return {
    onKeyDown(event: Event, editor: CoreEditor, next: Function) {
      const keyEvent = event as KeyboardEvent;

      // Handle enter
      if (handler && keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
        // Submit on Enter
        keyEvent.preventDefault();
        handler(keyEvent);
        return true;
      }

      return next();
    },
  };
}
