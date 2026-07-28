import { CoauthorKeyboardPage } from './CoauthorKeyboardPage';

/**
 * Updated highlight flow, in the same panel-editor chrome as /coauthor-keyboard
 * (which keeps the original flow for comparison). Reachable at
 * /coauthor-highlight.
 */
export function CoauthorHighlightPage() {
  return <CoauthorKeyboardPage variant="highlight-v2" />;
}

export default CoauthorHighlightPage;
