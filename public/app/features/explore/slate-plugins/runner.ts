import { Editor as SlateEditor } from 'slate';

export default function RunnerPlugin({ handler }: any) {
  return {
    onKeyDown(event: KeyboardEvent, editor: SlateEditor, next: Function) {
      // Handle enter
      if (handler && event.key === 'Enter' && !event.shiftKey) {
        // Submit on Enter
        event.preventDefault();
        handler(event);
        return true;
      }

      return next();
    },
  };
}
