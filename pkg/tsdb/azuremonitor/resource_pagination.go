package azuremonitor

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

const MaxArmPages = 50

type armListResponse struct {
	Value    []json.RawMessage `json:"value"`
	NextLink string            `json:"nextLink"`
}

type armHTTPError struct {
	status int
	body   string
}

func (e *armHTTPError) Error() string {
	return fmt.Sprintf("ARM request failed with status %d: %s", e.status, e.body)
}

func fetchArmPages(ctx context.Context, cli *http.Client, initialURL string, listAll bool, maxPages int) (value []json.RawMessage, nextToken string, truncated bool, err error) {
	value = []json.RawMessage{}
	nextURL := initialURL
	pages := 0
	for nextURL != "" {
		page, err := fetchArmPage(ctx, cli, nextURL)
		if err != nil {
			return nil, "", false, err
		}
		value = append(value, page.Value...)
		pages++

		if !listAll {
			return value, skipTokenFromNextLink(page.NextLink), false, nil
		}

		nextURL = rebaseNextLink(initialURL, page.NextLink)
		if nextURL != "" && pages >= maxPages {
			return value, skipTokenFromNextLink(page.NextLink), true, nil
		}
	}
	return value, "", false, nil
}

func rebaseNextLink(baseURL, nextLink string) string {
	if nextLink == "" {
		return ""
	}
	next, err := url.Parse(nextLink)
	if err != nil {
		return nextLink
	}
	base, err := url.Parse(baseURL)
	if err != nil {
		return nextLink
	}
	next.Scheme = base.Scheme
	next.Host = base.Host
	return next.String()
}

func fetchArmPage(ctx context.Context, cli *http.Client, rawURL string) (*armListResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}

	res, err := cli.Do(req)
	if err != nil {
		return nil, fmt.Errorf("unexpected error: %w", err)
	}
	defer func() { _ = res.Body.Close() }()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	if res.StatusCode/100 != 2 {
		return nil, &armHTTPError{status: res.StatusCode, body: string(body)}
	}

	var parsed armListResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("failed to parse ARM response: %w", err)
	}
	return &parsed, nil
}

func skipTokenFromNextLink(nextLink string) string {
	if nextLink == "" {
		return ""
	}
	u, err := url.Parse(nextLink)
	if err != nil {
		return ""
	}
	q := u.Query()
	if token := q.Get("$skiptoken"); token != "" {
		return token
	}
	return q.Get("$skipToken")
}

func appendSkipToken(rawURL, token string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	q := u.Query()
	q.Set("$skiptoken", token)
	u.RawQuery = q.Encode()
	return u.String()
}

func writePaginatedResponse(rw http.ResponseWriter, value []json.RawMessage, nextToken string, truncated bool, linkParams url.Values) error {
	body, err := json.Marshal(struct {
		Value []json.RawMessage `json:"value"`
	}{Value: value})
	if err != nil {
		return fmt.Errorf("failed to marshal response: %w", err)
	}

	rw.Header().Set("Content-Type", "application/json")
	if nextToken != "" {
		nextParams := url.Values{}
		for k, v := range linkParams {
			nextParams[k] = v
		}
		nextParams.Set("nextToken", nextToken)
		rw.Header().Set("Link", fmt.Sprintf(`<?%s>; rel="next"`, nextParams.Encode()))
	}
	if truncated {
		rw.Header().Set("X-Results-Truncated", "true")
	}

	rw.WriteHeader(http.StatusOK)
	if _, err := rw.Write(body); err != nil {
		return fmt.Errorf("unable to write HTTP response: %v", err)
	}
	return nil
}
