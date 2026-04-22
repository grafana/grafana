interface DOMParser {
  parseFromString(string: string | TrustedType, type: DOMParserSupportedType): Document;
}
