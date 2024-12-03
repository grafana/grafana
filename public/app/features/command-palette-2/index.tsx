import { CommandPalette2 } from './UI';
import { useCommandPalette } from './context';

interface EntrypointProps {}

/**
 * This is the public entrypoint for the command palette. It's what you put on your page
 * and this connects to the context state to render the actual UI when appropriate
 */
export function CommandPalette2Entrypoint(props: EntrypointProps) {
  const ctx = useCommandPalette();

  if (!ctx.state.isActive) {
    return null;
  }

  return <CommandPalette2 />;
}
