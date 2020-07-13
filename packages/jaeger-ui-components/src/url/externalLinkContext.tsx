// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React from 'react';

/**
 * There are several places where external links to spans are created. The url layout though is something
 * that should be decided on the application level and not on the component level but at the same time
 * propagating the factory function everywhere could be cumbersome so we use this context for that.
 */
const ExternalLinkContext = React.createContext<((traceID: string, spanID: string) => string) | undefined>(undefined);
ExternalLinkContext.displayName = 'ExternalLinkContext';
export default ExternalLinkContext;
