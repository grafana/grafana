import { type SignatureHelp, type SignatureHelpProvider } from '@grafana/ui/unstable';

import { getEnclosingFunctionCall } from './completionSituation';

interface SqlFunctionParameter {
  label: string;
  documentation?: string;
}

export interface SqlFunctionSignature {
  name: string;
  parameters: SqlFunctionParameter[];
  returnType?: string;
  documentation?: string;
}

/**
 * Builds a signature-help provider for the CodeMirror editor from a list of SQL
 * function signatures. Detection of the enclosing call is delegated to the SQL
 * syntax tree so the editor itself stays language-agnostic.
 */
export function getSqlSignatureHelpProvider(signatures: SqlFunctionSignature[]): SignatureHelpProvider {
  const signaturesByName = new Map(signatures.map((signature) => [signature.name.toLowerCase(), signature]));

  return (state, pos) => {
    const call = getEnclosingFunctionCall(state, pos);

    if (!call) {
      return null;
    }

    const signature = signaturesByName.get(call.name.toLowerCase());

    if (!signature) {
      return null;
    }

    return toSignatureHelp(signature, call.activeParameter);
  };
}

function toSignatureHelp(signature: SqlFunctionSignature, activeParameter: number): SignatureHelp {
  return {
    signatures: [
      {
        name: signature.name,
        returnType: signature.returnType,
        documentation: signature.documentation,
        parameters: signature.parameters.map((parameter) => ({
          label: parameter.label,
          documentation: parameter.documentation,
        })),
      },
    ],
    activeSignature: 0,
    activeParameter: clampActiveParameter(activeParameter, signature.parameters.length),
  };
}

/**
 * Keeps the active parameter within range. Variadic functions and stray commas
 * can push the count past the declared parameters, so we pin to the last one.
 */
function clampActiveParameter(activeParameter: number, parameterCount: number): number {
  if (parameterCount === 0) {
    return 0;
  }

  return Math.min(activeParameter, parameterCount - 1);
}
