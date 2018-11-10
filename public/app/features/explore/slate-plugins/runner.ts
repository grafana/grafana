export default function RunnerPlugin({ handler }) {
  return {
    onKeyDown(event) {
      // Handle enter
      if (handler && event.key === 'Enter' && !event.shiftKey) {
        // Submit on Enter
        event.preventDefault();
        handler(event);
        return true;
      }
      return undefined;
    },
  };
}
