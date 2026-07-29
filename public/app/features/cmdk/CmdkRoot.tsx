import { Cmdk } from './Cmdk';
import { useRegisterStaticActionsSource } from './sources/staticActionsSource';

/**
 * Composes the palette with the built-in sources that need React state (nav tree, contexts) to register,
 * the same way the old palette registered its actions from within the CommandPalette component. Keeps the
 * core Cmdk component independent of any concrete source.
 */
export function CmdkRoot() {
  useRegisterStaticActionsSource();

  return <Cmdk />;
}
