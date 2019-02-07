import { GrafanaTheme } from "../types";

export function getTheme(themeName?: string): GrafanaTheme
export function mockTheme(themeMock: (name: string) => object): () => void
