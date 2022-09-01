import { Plugin } from 'slate-react';

export function RunnerPlugin({ handler }: any): Plugin {
  return {
    onKeyDown(event, editor, next) {
      // Handle enter
      if (handler && event.key === 'Enter' && (event.shiftKey || event.ctrlKey)) {
        // Submit on Enter
        event.preventDefault();
        handler(event);
        return editor;
      }

      return next();
    },
  };
}
